class Api::BoardsController < ApplicationController
  extend ::NewRelic::Agent::MethodTracer
  before_action :require_api_token, :except => [:index, :user_index, :show, :simple_obf, :download]

  def index
    boards = Board
    if defined?(Octopus)
      conn = (Octopus.config[Rails.env] || {}).keys.sample
      boards = boards.using(conn) if conn
    end
    boards = boards.includes(:board_content)

    Rails.logger.warn('checking key')
    self.class.trace_execution_scoped(['boards/key_check']) do
      if params['key']
        keys = [params['key']]
        if @api_user
          keys << "#{@api_user.user_name}/#{params['key']}"
        end
        boards = boards.where(:key => keys)
      end
    end
    
    Rails.logger.warn('filtering by user')
    # TODO: where(:public => true) as the cancellable default
    self.class.trace_execution_scoped(['boards/user_filter']) do
      if params['user_id']
        user = User.find_by_path(params['user_id'])
        return unless allowed?(user, 'view_detailed')
        unless params['starred']
          if params['shared']
            Rails.logger.warn('looking up shared board ids')
            arel = Board.arel_table
            shared_board_ids = Board.all_shared_board_ids_for(user)
            # TODO: fix when sharding actually happens
            Rails.logger.warn('filtering by shared board ids')
            boards = boards.where(arel[:id].in(Board.local_ids(shared_board_ids)))
          elsif params['include_shared']
            arel = Board.arel_table
            Rails.logger.warn('looking up shared board ids')
            shared_board_ids = Board.all_shared_board_ids_for(user)
            # TODO: fix when sharding actually happens
            Rails.logger.warn('filtering by share board ids')
            boards = boards.where(arel[:user_id].eq(user.id).or(arel[:id].in(Board.local_ids(shared_board_ids))))
          else
            boards = boards.where(:user_id => user.id)
          end
        end
        if !params['public']
          Rails.logger.warn('checking for supervision permission')
          return unless allowed?(user, 'model')
        end
        if params['private']
          Rails.logger.warn('checking for publicness')
          boards = boards.where(:public => false)
        end
        if params['starred']
          Rails.logger.warn('filtering by user or public')
          # TODO: this still won't include boards of people I supervise... (because it shouldn't)
          boards = boards.where(['user_id = ? OR public = ?', user.id, true])
          ids = (user.settings['starred_board_ids'] || [])
          # TODO: sharding
          Rails.logger.warn('filtering by starred board ids')
          boards = boards.where(:id => Board.local_ids(ids))
        end
      else
        params['public'] = true
      end
    end
    
    Rails.logger.warn('public query')
    ranks = {}
    self.class.trace_execution_scoped(['boards/public_query']) do
      if !params['q'].blank? && params['public']
        q = CGI.unescape(params['q']).downcase
        locs = BoardLocale
        if !params['locale'].blank? && params['locale'] != 'any'
          locs = locs.where(locale: [params['locale'], params['locale'].split(/-|_/)[0]])
        end
        if params['user_id']
          board_ids = boards.select('id').limit(2000).map(&:id)
          locs = locs.where(board_id: board_ids)
        end
        if params['sort'] == 'home_popularity'
          board_ids = []
          locs.search_by_text_for_home_popularity(q).limit(250).with_pg_search_rank.each do |bl|
            board_ids << bl.board_id
            ranks[bl.board_id] = bl.pg_search_rank
          end
          boards = boards.where(id: board_ids)
        else
          board_ids = []
          locs.search_by_text(q).limit(250).with_pg_search_rank.each do |bl|
            board_ids << bl.board_id
            ranks[bl.board_id] = bl.pg_search_rank
          end
          boards = boards.where(id: board_ids)
        end
      end
    end
    if !params['locale'].blank? && params['locale'] != 'any' && (params['q'].blank? || !params['public'])
      # board.search_string now includes locales, even on private boards
      # This filter should be applied for private searches (which wouldn't yet
      # have been filtered by locale) or for requests without a search query
      lang = params['locale'].split(/-|_/)[0].downcase
      boards = boards.where(['search_string ILIKE ?', "%locale:#{lang}%"])
    end

    Rails.logger.warn('public check')
    self.class.trace_execution_scoped(['boards/public_check']) do
      if params['public']
        boards = boards.where(:public => true)
      end
    end

    Rails.logger.warn('sort board')
    self.class.trace_execution_scoped(['boards/sort']) do
      if params['sort']
        if params['sort'] == 'popularity'
          boards = boards.order(popularity: :desc, home_popularity: :desc, id: :desc)
        elsif params['sort'] == 'home_popularity'
          if !params['user_id']
            boards = boards.where(['home_popularity > ?', 0]).order(home_popularity: :desc, id: :desc)
          else
            boards = boards.order(home_popularity: :desc, id: :desc)
          end
        elsif params['sort'] == 'custom_order'
          boards = boards[0, 100].sort_by{|b| b.settings['custom_order'] || b.id }
        end
      else
        boards = boards.order(popularity: :desc, any_upstream: :asc, id: :desc)
      end
    end
    
    Rails.logger.warn('starred filter')
    if params['exclude_starred']
      user = User.find_by_path(params['exclude_starred'])
      exclude_board_ids = []
      if user && user.settings['public']
        exclude_board_ids = user.settings['starred_board_ids'] || []
      end
      boards = boards.limit(100) if boards.respond_to?(:limit)
      boards = boards[0, 100].select{|b| !exclude_board_ids.include?(b.global_id) }
    end
    
    Rails.logger.warn('category filter')
    self.class.trace_execution_scoped(['boards/category']) do
      if params['category']
        boards = boards.limit(200) if boards.respond_to?(:limit)
        boards = boards[0, 200].select{|b| b.categories.include?(params['category']) }
      elsif params['copies'] == false || params['copies'] == 'false'
        boards = boards.limit(500) if boards.respond_to?(:limit)
        boards = boards[0, 500].select{|b| !b.parent_board_id }[0, 100]
      end
    end

    if params['sort'] && params['sort'] != 'custom_order' && params['locale']
      # All locale-defined lists should already have been filtered by locale
      # and search relevance, so we can safely trim to the top results here
      boards = Board.sort_for_locale(boards[0, 50], params['locale'], params['sort'], ranks)
    end

    # Private boards don't have search_string set as a column to protect against 
    # leakage of private information. This iterative method is slower than a db clause
    # so we limit the possible result set to be more performant, which will only
    # be an issue for search users with very many boards (still problematic, I know)
    Rails.logger.warn('private query')
    self.class.trace_execution_scoped(['boards/private_query']) do
      if params['root']
        boards = boards.select{|b| !b.settings['copy_id'] || b.settings['copy_id'] == b.global_id }
      end

      if !params['q'].blank? && !params['public']
        boards = boards.limit(500) if boards.respond_to?(:limit)
        boards = Board.sort_for_query(boards, params['q'], params['locale'])
      end
    end
    
    json = nil
    Rails.logger.warn('start paginated result')
    self.class.trace_execution_scoped(['boards/json_paginate']) do
      json = JsonApi::Board.paginate(params, boards, {locale: params['locale']})
    end

    render json: json
  end
  
  def show
    Rails.logger.warn('looking up board')
    board = Board.find_by_path(params['id'])
    if !board
      deleted_board = DeletedBoard.find_by_path(params['id'])
      # TODO: Sharding
      deleted_board ||= DeletedBoard.find_by(:id => (Board.local_ids([params['id']])[0] || 0))
      user = deleted_board && deleted_board.user
      res = {error: "Record not found"}
      res[:id] = params['id']
      if deleted_board && user && user.allows?(@api_user, 'view_deleted_boards')
        res[:deleted] = true
        res[:key] = deleted_board.key
        return api_error 404, res
      elsif params['id'].match(/\//)
        user = User.find_by_path(params['id'].split(/\//)[0])
        if user && user.allows?(@api_user, 'view_deleted_boards')
          res[:never_existed] = true
          return api_error 404, res
        end
      end
      return unless exists?(board)
    end
    allowed = false
    Rails.logger.warn('checking permission')
    self.class.trace_execution_scoped(['boards/board/permission_check']) do
      allowed = allowed?(board, 'view')
    end
    return unless allowed
    json = {}
    Rails.logger.warn('rendering json')
    self.class.trace_execution_scoped(['boards/board/json_render']) do
      json = JsonApi::Board.as_json(board, :wrapper => true, :permissions => @api_user, :skip_subs => !!request.headers['X-SUPPORTS-REMOTE-BUTTONSET'])
    end
    Rails.logger.warn('rails render')
    render json: json.to_json
    Rails.logger.warn('done with controller')
  end
  
  def create
    @board_user = @api_user
    processed_params = params
    # Necessary because by default Rails is stripping out nil references in an array, which
    # messes up grid.order
    if request.content_type == 'application/json'
      processed_params = JSON.parse(request.body.read)
    end
    if processed_params['board'] && processed_params['board']['for_user_id'] && processed_params['board']['for_user_id'] != 'self'
      user = User.find_by_path(processed_params['board']['for_user_id'])
      return unless allowed?(user, 'edit')
      @board_user = user
    end
    board = Board.process_new(processed_params['board'], {:user => @board_user, :author => @api_user, :key => params['board']['key']})
    if board.errored?
      api_error(400, {error: "board creation failed", errors: board && board.processing_errors})
    else
      render json: JsonApi::Board.as_json(board, :wrapper => true, :permissions => @api_user).to_json
    end
  end
  
  def share_response
    board = Board.find_by_path(params['board_id'])
    return unless exists?(board)
    return unless allowed?(board, 'view')
    approve = !!(params['approve'] == 'true' || params['approve'] == true || params['approve'] == 1 || params['approve'] == '1')
    if board.update_shares_for(@api_user, approve)
      render json: {updated: true, approved: approve}.to_json
    else
      api_error(400, {error: "board share update failed"})
    end
  end
  
  def copies
    board = Board.find_by_path(params['board_id'])
    return unless exists?(board)
    return unless allowed?(board, 'view')
    boards = board.find_copies_by(@api_user)
    render json: JsonApi::Board.paginate(params, boards)
  end
  
  def update
    board = Board.find_by_path(params['id'])
    if !board
      deleted_board = DeletedBoard.find_by_path(params['id'])
      deleted_board ||= DeletedBoard.find_by_path((params['board'] || {})['key'])
      if deleted_board && params['board'] && deleted_board.key == params['board']['key']
        # TODO: it should be allowable to restore a deleted board that has a different 
        # key, it should just use a different key instead
        user_name = deleted_board.key && deleted_board.key.split(/\//)[0]
        user = User.find_by_path(user_name)
        return unless allowed?(user, 'supervise')
        return allowed?(user, 'never_allow') if deleted_board.board
        board = Board.new
        board.id = deleted_board.board_id
        board.user = user
        board.generate_unique_key(deleted_board.key)
        board.settings = {}
        board.settings['undeleted'] = true
        board.save
      end
    end    
    return unless exists?(board, params['id'])
    return unless allowed?(board, 'edit')
    processed_params = params
    # Necessary because by default Rails is stripping out nil references in an array, which
    # messes up grid.order
    if request.content_type == 'application/json'
      processed_params = JSON.parse(request.body.read)
    end
    res = false
    if processed_params['button']
      res = board.process_button(processed_params['button'])
    else
      res = board.process(processed_params['board'], {:user => @api_user, :starrer => @api_user})
    end
    if res
      render json: JsonApi::Board.as_json(board, :wrapper => true, :permissions => @api_user).to_json
    else
      api_error(400, {error: "board update failed", errors: board.processing_errors})
    end
  end
  
  def history
    board_id = nil
    board = Board.find_by_path(params['board_id'])
    deleted_board = DeletedBoard.find_by_path(params['board_id'])
    return unless exists?(board || deleted_board)
    allowed = @api_user.allows?(@api_user, 'admin_support_actions')
    if board
      return unless allowed || allowed?(board, 'edit')
      board_id = board.global_id
    elsif deleted_board && deleted_board.user
      return unless allowed || allowed?(deleted_board.user, 'view_deleted_boards')
      board_id = deleted_board.board_global_id
    end
    return unless exists?(board_id)
    versions = Board.user_versions(board_id)
    render json: JsonApi::BoardVersion.paginate(params, versions, {:admin => Organization.admin_manager?(@api_user)})
  end
  
  def rename
    board = Board.find_by_path(params['board_id'])
    return unless exists?(board)
    return unless allowed?(board, 'edit')
    if params['new_key'] && params['old_key'] == board.key && board.rename_to(params['new_key'])
      render json: {rename: true, key: params['new_key']}.to_json
    else
      api_error(400, {error: "board rename failed", key: params['key'], collision: board.collision_error?})
    end
  end
  
  def unlink
    board = Board.find_by_path(params['board_id'])
    user = User.find_by_path(params['user_id'])
    type = params['type']
    return unless exists?(board)
    return unless allowed?(user, 'edit')
    if type == 'delete'
      return unless allowed?(board, 'delete')
      board.destroy
    elsif type == 'unstar'
      board.star!(user, false)
    elsif type == 'unlink'
      board.unshare_with(user)
    else
      return api_error(400, {error: "unrecognized type"})
    end
    render json: {removed: true, type: type}.to_json
  end
  
  def star
    star_or_unstar(true)
  end
  
  def unstar
    star_or_unstar(false)
  end
  
  def stats
    board = Board.find_by_path(params['board_id'])
    return unless exists?(board, params['board_id'])
    return unless allowed?(board, 'view')
    render json: Stats.board_use(board.global_id, {}).to_json
  end

  def simple_obf
    board = Board.find_by_path(params['board_id'])
    return unless exists?(board, params['board_id'])
    return unless allowed?(board, 'view')
    file = Tempfile.new(["board-#{board.global_id}", '.obf'])
    path = file.path
    file.close
    json = Converters::CoughDrop.to_external(board, {'simple' => true})
    OBF::External.to_obf(json, path, nil, {image_urls: true, sound_urls: true})
    send_data File.read(path), :type => 'application/obf', :disposition => 'attachment', :filename => "board-#{board.global_id}.obf"
  end
  
  def destroy
    board = Board.find_by_path(params['id'])
    return unless exists?(board)
    return unless allowed?(board, 'delete')
    board.destroy
    render json: JsonApi::Board.as_json(board, :wrapper => true).to_json
  end
  
  def download
    board = Board.find_by_path(params['board_id'])
    return unless exists?(board)
    return unless allowed?(board, 'view')
    progress = Progress.schedule(board, :generate_download, (@api_user && @api_user.global_id), params['type'], {
      'include' => params['include'],
      'headerless' => params['headerless'] == '1',
      'text_on_top' => params['text_on_top'] == '1',
      'transparent_background' => params['transparent_background'] == '1',
      'symbol_background' => params['symbol_background'],
      'text_only' => params['text_only'] == '1',
      'text_case' => params['text_case'],
      'font' => params['font']
    })
    render json: JsonApi::Progress.as_json(progress, :wrapper => true).to_json
  end
  
  def import
    if params['url']
      progress = Progress.schedule(Board, :import, @api_user.global_id, params['url'])
      render json: JsonApi::Progress.as_json(progress, :wrapper => true).to_json
    else
      type = (params['type'] == 'obz' ? 'obz' : 'obf')
      remote_path = "imports/boards/#{@api_user.global_id}/upload-#{GoSecure.nonce('filename')}.#{type}"
      content_type = "application/#{type}"
      params = Uploader.remote_upload_params(remote_path, content_type)
      url = params[:upload_url] + remote_path
      params[:success_url] = "/api/v1/boards/imports?type=#{type}&url=#{CGI.escape(url)}"
      render json: {'remote_upload' => params}.to_json
    end
  end
  
  def translate
    board = Board.find_by_path(params['board_id'])
    return unless exists?(board, params['board_id'])
    return unless allowed?(board, 'edit')
    ids = params['board_ids_to_translate'] || []
    ids << board.global_id
    translations = params['translations']
    translations = translations.to_unsafe_h if translations.respond_to?(:to_unsafe_h)
    set_as_default = true
    set_as_default = false if params['set_as_default'] == false || params['set_as_default'] == 'false' || params['set_as_default'] == 0 || params['set_as_default'] == '0'
    progress = Progress.schedule(board, :translate_set, translations, {
      'source' => params['source_lang'],
      'dest' => params['destination_lang'],
      'allow_fallbacks' => params['fallbacks'] == '1' || params['fallbacks'] == 'true' || params['fallbacks'] == true || params['fallbacks'] == 1,
      'board_ids' => ids,
      'default' => set_as_default,
      'user_key' => user_for_paper_trail
    })
    render json: JsonApi::Progress.as_json(progress, :wrapper => true).to_json
  end

  def swap_images
    board = Board.find_by_path(params['board_id'])
    return unless exists?(board, params['board_id'])
    return unless allowed?(board, 'edit')
    ids = params['board_ids_to_convert'] || []
    ids << board.global_id
    progress = Progress.schedule(board, :swap_images, params['library'], @api_user.global_id, ids)
    render json: JsonApi::Progress.as_json(progress, :wrapper => true).to_json
  end

  protected
  def star_or_unstar(star)
    board = Board.find_by_path(params['board_id'])
    return unless exists?(board)
    return unless allowed?(board, 'view')
    board.star!(@api_user, star)
    render json: {starred: board.starred_by?(@api_user), stars: board.stars}.to_json
  end
  
end
