class Board < ActiveRecord::Base
  DEFAULT_ICON = "https://opensymbols.s3.amazonaws.com/libraries/arasaac/board_3.png"
  include Processable
  include Permissions
  include Async
  include UpstreamDownstream
  include Relinking
  include GlobalId
  include MetaRecord
  include Notifier
  include SecureSerialize
  include Sharing
  include Renaming

  has_many :board_button_images
  has_many :button_images, :through => :board_button_images
  has_many :board_button_sounds
  has_many :button_sounds, :through => :board_button_sounds
  has_many :log_session_boards
  belongs_to :user
  belongs_to :parent_board, :class_name => 'Board'
  belongs_to :board_content
  has_many :child_boards, :class_name => 'Board', :foreign_key => 'parent_board_id'
  # pg_search_scope :search_by_text, :against => :search_string, :ranked_by => "log(boards.popularity + boards.home_popularity + 3) * :tsearch"
  # pg_search_scope :search_by_text_for_home_popularity, :against => :search_string, :ranked_by => "log(boards.home_popularity + 2) * :tsearch"
  before_save :generate_defaults
  before_save :require_key
  before_save :check_inflections
  before_save :check_content_overrides
  after_save :post_process
  after_destroy :flush_related_records
#  replicated_model
 
  has_paper_trail :only => [:current_revision, :settings, :name, :key, :public, :parent_board_id, :user_id, :board_content_id],
                  :if => Proc.new{|b| PaperTrail.request.whodunnit && !PaperTrail.request.whodunnit.match(/^job/) }
  secure_serialize :settings

  # cache should be invalidated if:
  # - it is shared or unshared (including upstream)
  # - an author is added or removed (via sharing)
  # - it gains a new upstream link
  # - the author's supervision settings change
  # public boards anyone can view
  add_permissions('view', ['*']) { self.public }
  # check cached list of explicitly-allowed private boards
  add_permissions('view', ['read_boards']) {|user| !self.public && user.can_view?(self) }
  add_permissions('view', 'edit', 'delete', 'share') {|user| user.can_edit?(self) }
  # explicitly-shared boards are viewable
#  add_permissions('view', ['read_boards']) {|user| self.shared_with?(user) } # should be redundant due to board_caching
  # the author's supervisors can view the author's boards
  # the user (and co-authors) should have edit and sharing access
#  add_permissions('view', ['read_boards']) {|user| self.author?(user) } # should be redundant due to board_caching
#  add_permissions('view', 'edit', 'delete', 'share') {|user| self.author?(user) } # should be redundant due to board_caching
  add_permissions('view', ['read_boards']) {|user| self.user && self.user.allows?(user, 'model') }
  # the user and any of their editing supervisors/org admins should have edit access
  add_permissions('view', ['read_boards']) {|user| self.user && self.user.allows?(user, 'edit') }
  add_permissions('view', 'edit', 'delete', 'share') {|user| self.user && self.user.allows?(user, 'edit_boards') }
  # the user should have edit and sharing access if a parent board is edit-shared including downstream with them
#  add_permissions('view', ['read_boards']) {|user| self.shared_with?(user, true) } # should be redundant due to board_caching
#  add_permissions('view', 'edit', 'delete', 'share') {|user| self.shared_with?(user, true) } # should be redundant due to board_caching
  # the user should have view access if the board is shared with any of their supervisees
#  add_permissions('view', ['read_boards']) {|user| user.supervisees.any?{|u| self.shared_with?(u) } } # should be redundant due to board_caching
  cache_permissions

  def starred_by?(user)
    user_id = user && user.global_id
    !!(user && user.global_id && !!(self.settings['starred_user_ids'] || []).detect{|id| id == user_id || id.to_s.match(/.+:#{user_id}/) })
  end
  
  def star(user, star, locale=nil)
    self.settings ||= {}
    locale ||= self.settings['locale'] || 'en'
    self.settings['starred_user_ids'] ||= []
    if user
      if star
        if !starred_by?(user)
          self.settings['starred_user_ids'] << "#{locale}:#{user.global_id}"
        end
      else
        user_id = user.global_id
        self.settings['starred_user_ids'] = self.settings['starred_user_ids'].select{|id| id != user_id && !id.to_s.match(/.+:#{user_id}/) }
      end
      self.settings['never_edited'] = false
      self.generate_stats
      user.schedule(:remember_starred_board!, self.global_id)
    end
  end

  def star!(user, star)
    pre_whodunnit = PaperTrail.request.whodunnit
    PaperTrail.request.whodunnit = "job:star_user"
    self.star(user, star)
    res = self.save
    PaperTrail.request.whodunnit = pre_whodunnit
    res
  end
  
  def button_set_id
    id = self.settings && self.settings['board_downstream_button_set_id']
    if !id
      # TODO: sharding
      bs = BoardDownstreamButtonSet.select('id').find_by(:board_id => self.id)
      id = bs && bs.global_id
    end
    return nil unless id
    full_id = id + "_" + GoSecure.sha512(id, 'button_set_id')[0, 10]
  end
  
  def board_downstream_button_set
    bs = nil
    if self.settings && self.settings['board_downstream_button_set_id']
      bs = BoardDownstreamButtonSet.find_by_global_id(self.settings['board_downstream_button_set_id'])
    else
      bs = BoardDownstreamButtonSet.find_by(:board_id => self.id)
    end
    bs.assert_extra_data if bs
    bs
  end
  
  def non_author_starred?
    self.user && ((self.settings || {})['starred_user_ids'] || []).any?{|s| s != self.user.global_id && !s.to_s.match(self.user.global_id) }
  end
  
  def stars
    (self.settings || {})['stars'] || ((self.settings || {})['starred_user_ids'] || []).length
  end

  def self.refresh_stats(board_ids)
    board_ids.each_slice(25) do |ids|
      Board.find_all_by_global_id(ids).each do |board|
        board.generate_stats
        board.save_without_post_processing
      end
    end
  end
  
  def generate_stats
    # TODO: only recount these when necessary
    self.settings['stars'] = (self.settings['starred_user_ids'] || []).length
    self.settings['locale_stars'] = {}

    pops = {}
    home_pops = {}
    locales = []
    (BoardContent.load_content(self, 'translations') || {}).each do |k, trans|
      if trans.is_a?(Hash)
        locales += trans.keys
      end
    end
    locales.uniq!
    (self.settings['starred_user_ids'] || []).select{|s| s.to_s.match(/:/) }.each do |str|
      loc = str.split(/:/)[0]
      self.settings['locale_stars'][loc] ||= 0
      self.settings['locale_stars'][loc] += 1
      if loc.match(/-|_/)
        lang = loc.split(/-|_/)[0]
        self.settings['locale_stars'][lang] ||= 0
        self.settings['locale_stars'][lang] += 1
      end
    end
    child_board_ids = self.child_boards.select('id').map(&:id)
    self.settings['forks'] = child_board_ids.length
    child_conns = UserBoardConnection.where(:board_id => child_board_ids)
    self.settings['home_forks'] = 0
    self.settings['recent_home_forks'] = 0
    self.settings['recent_forks'] = 0
    self.settings['locale_home_forks'] = {}
    child_conns.each do |ubc|
      if !ubc.locale
        UserBoardConnection.where(id: ubc.id).update_all(locale: ubc.board.settings['locale'])
        ubc.locale = ubc.board.settings['locale']
      end
      loc = (ubc.locale || 'en').split(/_|-/)[0]
      self.settings['home_forks'] += 1 if ubc.home
      self.settings['locale_home_forks'][ubc.locale] = (self.settings['locale_home_forks'][ubc.locale] || 0) + 1 if ubc.home
      self.settings['locale_home_forks'][loc] = (self.settings['locale_home_forks'][loc] || 0) + 1 if ubc.home && ubc.locale != loc
      if ubc.updated_at > 30.days.ago
        self.settings['recent_forks'] += 1 
        self.settings['recent_home_forks'] += 1 if ubc.home
      end
    end
      
    conns = UserBoardConnection.where(:board_id => self.id)
    self.settings['home_uses'] = 0
    self.settings['recent_home_uses'] = 0
    self.settings['uses'] = 0
    self.settings['recent_uses'] = 0
    self.settings['non_author_uses'] = 0
    self.settings['locale_home_uses'] = {}
    conns.each do |ubc|
      if !ubc.locale
        UserBoardConnection.where(id: ubc.id).update_all(locale: ubc.board.settings['locale'])
        ubc.locale = ubc.board.settings['locale']
      end
      loc = (ubc.locale || 'en').split(/_|-/)[0]
      self.settings['home_uses'] +=1 if ubc.home
      self.settings['recent_home_uses'] += 1 if ubc.home && ubc.updated_at > 30.days.ago
      self.settings['uses'] += 1
      self.settings['recent_uses'] += 1 if ubc.updated_at > 30.days.ago
      self.settings['non_author_uses'] +=1 if ubc.user_id != self.user_id
      self.settings['locale_home_uses'][ubc.locale] = (self.settings['locale_home_uses'][ubc.locale] || 0) + 1 if ubc.home
      self.settings['locale_home_uses'][loc] = (self.settings['locale_home_uses'][loc] || 0) + 1 if ubc.home && ubc.locale != loc
    end
    self.any_upstream ||= false
    if self.settings['never_edited']
      self.popularity = -1
      self.home_popularity = -1
    else
      # TODO: a real algorithm perchance?
      self.popularity = (self.settings['stars'] * 10) + self.settings['uses'] + (self.settings['forks'] * 2) + (self.settings['recent_uses'] * 3) + (self.settings['recent_forks'] * 3)
      self.home_popularity = (self.any_upstream ? 0 : 10) + (self.settings['stars'] * 3) + self.settings['home_uses'] + (self.settings['home_forks'] * 2) + (self.settings['recent_home_uses'] * 5) + (self.settings['recent_home_forks'] * 5)
      if self.parent_board_id
        self.popularity /= 3
        self.home_popularity /= 3
      end
    end
    found_locales = {}
    found_locales[self.settings['locale']] = true
    locales.each do |locale|
      found_locales[locale] = true
      lang = locale.split(/-|_/)[0]
      found_locales[lang] = true
      pop_score = ((self.settings['locale_stars'][locale] || 0) * 10) + (self.settings['locale_home_uses'][locale] || 0) + ((self.settings['locale_home_forks'][locale] || 0) * 2)
      home_pop_score = (self.any_upstream ? 0 : 10) + ((self.settings['locale_stars'][locale] || 0) * 3) + (self.settings['locale_home_uses'][locale] || 0) + ((self.settings['locale_home_forks'][locale] || 0) * 2)
      pops[locale] = pop_score
      home_pops[locale] = home_pop_score
      pops[lang] = [pops[lang] || 0, pop_score].max
      home_pops[lang] = [home_pops[lang] || 0, home_pop_score].max
    end
    self.settings['total_buttons'] = (self.buttons || []).length + (self.settings['total_downstream_buttons'] || 0)
    self.settings['unlinked_buttons'] = (self.buttons || []).select{|btn| !btn['load_board'] }.length + (self.settings['unlinked_downstream_buttons'] || 0)
    if self.public
      found_locales.each do |locale, nvmd|
        bl = BoardLocale.find_or_create_by(board_id: self.id, locale: locale)
        bl.search_string = self.search_string_for(locale)
        if self.settings['never_edited']
          bl.popularity = -1
          bl.home_popularity = -1
        else
          bl.popularity = home_pops[locale] || 0
          bl.home_popularity = pops[locale] || 0
        end
        bl.save
      end
    else
      BoardLocale.where(board_id: self.id).delete_all
    end
    if (self.buttons || []).length == 0
      self.popularity = 0
      self.home_popularity = 0
    end
    true
  end

  def search_string_for(locale)
    lang = (locale || 'en').split(/-|_/)[0]
    trans =  BoardContent.load_content(self, 'translations') || {}
    board_string = ""
    val = nil
    if trans['board_name']
      val = trans['board_name'][locale] || trans['board_name'][lang]
      if !val
        other = trans['board_name'].keys.detect{|l| l.match(/^#{lang}/)}
        val = trans['board_name'][other] if other
      end
    end
    val ||= self.settings['name']
    board_string += val
    grid = BoardContent.load_content(self, 'grid')
    buttons = self.buttons
    if grid && buttons
      grid['columns'].times do |jdx|
        grid['rows'].times do |idx|
          id = grid['order'][idx] && grid['order'][idx][jdx]
          button = buttons.detect{|b| b['id'] == id } || {}
          btn_trans = ((trans || {})[id.to_s] || {})
          val = (btn_trans[locale] || {})['label'] || (btn_trans[lang] || {})['label']
          if !val
            other = btn_trans.keys.detect{|l| l.match(/^#{lang}/)}
            val = btn_trans[other]['label'] if other
          end
          val ||= button['label'] || ''
          board_string += " " + val + ","
        end
      end
    end
    board_string += " " + self.key
    board_string += " " + (self.settings['name'] || "").downcase
    board_string += " " + (self.settings['description'] || "").downcase
    board_string
  end

  def self.long_query(query, locale, board_ids)
    offset = 0
    result = []
    board_ids.each_slice(25) do |ids|
      break if result.length > 50
      boards = Board.find_all_by_global_id(ids).sort_by{|b| ids.index(b.global_id) }
      result += Board.sort_for_query(boards, query, locale, offset, board_ids.length)
      offset += 25
    end
    result = result.sort_by{|b| b.instance_variable_get('@boost')}.reverse
    JsonApi::Board.paginate({}, result, {locale: locale})
  end

  def self.sort_for_query(boards_slice, query, locale, offset, total)
    locale ||= 'any'
    boards = []
    lang = locale.split(/-|_/)[0]
    boards_slice.each_with_index do |brd, idx| 
      break if boards.length > 50
      board_string = ""
      boost = 1 - ((idx + offset).to_f / total.to_f / 2.0)
      if brd.settings['locale'] == locale
        boost += 1 
        board_string += "locale:#{locale}"
      elsif (brd.settings['locale'] || 'en').split(/-|_/)[0] == lang.split(/-|_/)[0]
        boost += 0.5 
        board_string += "locale:#{lang}"
      end
      board_string = " " + brd.search_string_for(locale == 'any' ? (brd.settings['locale'] || 'en') : locale)
      if board_string.match(/#{query}/i)
        boost *= 10 
        boards << brd
      end
      brd.instance_variable_set('@boost', boost) 
    end
    query = CGI.unescape(query || '').downcase
    res = boards.sort_by{|b| b.instance_variable_get('@boost')}.reverse
  end

  def self.sort_for_locale(boards, locale, sort, ranks)
    # When sorting by locale, apply a locale boost for a re-sort
    return boards unless locale && locale != 'any' && sort
    res = boards.sort_by do |board|
      boost = 1 * (ranks[board.id] || 0.1)
      forks = (board.settings['locale_home_forks'] || {})[locale] || (board.settings['locale_home_forks'] || {})[locale.split(/-|_/)[0]] || 0
      uses = (board.settings['locale_home_uses'] || {})[locale] || (board.settings['locale_home_uses'] || {})[locale.split(/-|_/)[0]] || 0
      stars = (board.settings['locale_stars'] || {})[locale] || (board.settings['locale_stars'] || {})[locale.split(/-|_/)[0]] || 0
      if sort == 'popularity'
        boost += 5 if board.settings['locale'] == locale
        boost += 3 if board.settings['locale'] != locale && board.settings['locale'].split(/-|_/)[0] == locale.split(/-|_/)[0]
        boost += uses / 3
        boost += forks / 5
        boost += stars
      elsif sort == 'home_popularity'
        boost += 5 if board.settings['locale'] == locale
        boost += 3 if board.settings['locale'] != locale && board.settings['locale'].split(/-|_/)[0] == locale.split(/-|_/)[0]
        boost += uses
        boost += forks / 3
        boost += stars / 2
      end
      (board.popularity || -1) * boost
    end
    res.reverse
  end

  def check_content_overrides
    BoardContent.track_differences(self, self.board_content, true) if self.board_content
    true
  end

  def edit_key
    self.settings['edit_key']
  end
  
  def find_copies_by(user)
    if user
      ids = [user.id] + self.class.local_ids(user.supervised_user_ids || [])
      # TODO: sharding
      boards = Board
      if defined?(Octopus)
        conn = (Octopus.config[Rails.env] || {}).keys.sample
        boards = Board.using(conn) if conn
      end
      boards.includes(:board_content).where(:parent_board_id => self.id, :user_id => ids).sort_by{|b| [b.user_id == user.id ? 0 : 1, 0 - b.id] }
    else
      []
    end
  end
  
  def self.import(user_id, url)
    boards = []
    user = User.find_by_global_id(user_id)
    Progress.update_current_progress(0.05, :generating_boards)
    Progress.as_percent(0.05, 0.9) do
      boards = Converters::Utils.remote_to_boards(user, url)
    end
    boards.each do |board|
      board.settings['copy_id'] = boards[0].global_id
      board.save
    end
    return boards.map{|b| JsonApi::Board.as_json(b, :permissions => user) }
  end
  
  def generate_download(user_id, type, opts)
    res = {}
    user = User.find_by_global_id(user_id)
    Progress.update_current_progress(0.03, :generating_files)
    Progress.as_percent(0.03, 0.9) do
      if ['obz', 'obf', 'pdf'].include?(type.to_s)
        url = Converters::Utils.board_to_remote(self, user, {
          'file_type' => type.to_s,
          'include' => opts['include'] || 'this',
          'headerless' => !!opts['headerless'],
          'text_on_top' => !!opts['text_on_top'],
          'transparent_background' => !!opts['transparent_background'],
          'symbol_background' => opts['symbol_background'],
          'text_only' => !!opts['text_only'],
          'text_case' => opts['text_case'],
          'font' => opts['font']
        })
        if !url
          raise Progress::ProgressError, "No URL generated"
        end
        res = {:download_url => Uploader.fronted_url(url)}
      else
        raise Progress::ProgressError, "Unexpected download type, #{type}"
      end
    end
    return res
  end
  
  def generate_defaults
    self.settings ||= {}
    self.settings['name'] ||= "Unnamed Board"
    self.settings['edit_key'] = Time.now.to_f.to_s + "-" + rand(9999).to_s
    if !self.settings['image_url']
      self.settings['image_url'] = DEFAULT_ICON
      self.settings['default_image_url'] = DEFAULT_ICON
    elsif self.settings['image_url'] != self.settings['default_image_url']
      self.settings['default_image_url'] = nil
    end
    @brand_new = !self.id
    @buttons_changed = true if self.buttons && !self.id
    @button_links_changed = true if (self.buttons || []).any?{|b| b['load_board'] } && !self.id
    if @edit_description
      if self.settings['edit_description'] && self.settings['edit_description']['timestamp'] < @edit_description['timestamp'] - 1
        @edit_description = nil
      end
    end
    self.settings['edit_description'] = @edit_description
    @edit_description = nil

    self.settings['buttons'] ||= []
    self.buttons.each do |button|
      if button['load_board'] && button['load_board']['id'] && button['load_board']['id'] == self.related_global_id(self.parent_board_id) && @update_self_references == nil && !self.settings['self_references_updated']
        @update_self_references = true
      end
    end
    self.any_upstream = self.settings && self.settings['immediately_upstream_board_ids'] && self.settings['immediately_upstream_board_ids'].length > 0
    self.any_upstream ||= false
    grid = BoardContent.load_content(self, 'grid')
    grid ||= {}
    grid['rows'] = (grid['rows'] || 2).to_i
    grid['columns'] = (grid['columns'] || 4).to_i
    grid['order'] ||= []
    grid['rows'].times do |i|
      grid['order'][i] ||= []
      grid['columns'].times do |j|
        grid['order'][i][j] ||= nil
      end
      if grid['order'][i].length > grid['columns']
        grid['order'][i] = grid['order'][i].slice(0, grid['columns'])
      end
    end
    if grid['order'].length > grid['rows']
      grid['order'] = grid['order'].slice(0, grid['rows'])
    end
    if grid['labels'] && self.buttons.length == 0
      self.populate_buttons_from_labels(grid.delete('labels'), grid.delete('labels_order'))
    end
    self.settings['grid'] = grid # TODO: ...only set if changed
    update_immediately_downstream_board_ids
    
    data_hash = Digest::MD5.hexdigest(self.global_id.to_s + "_" + grid.to_json + "_" + self.buttons.to_json)
    self.settings['revision_hashes'] ||= []
    if !self.settings['revision_hashes'].last || self.settings['revision_hashes'].last[0] != data_hash
      @track_revision = [data_hash, Time.now.to_i]
      self.settings['revision_hashes'] << @track_revision
      self.current_revision = data_hash
    end
    
    self.settings['license'] ||= {type: 'private'}
    # self.name = self.settings['name']
    if self.unshareable?
      self.public = false unless self.settings['protected'] && self.settings['protected']['demo'] && !self.parent_board_id
    elsif self.public == nil
      if self.user && self.user.any_premium_or_grace_period?(true)
        self.public = false
      else
        self.public = true
      end
    end
    UserLink.invalidate_cache_for(self)
          
    self.settings['locale'] ||= 'en'
    langs = []
    (BoardContent.load_content(self, 'translations') || {}).each do |k, trans|
      if trans.is_a?(Hash)
        langs += trans.keys
      end
    end
    langs.uniq!
    self.settings['locales'] = ([self.settings['locale']] + langs).uniq
    self.settings.delete('search_string')
    self.search_string = self.settings['locales'].map{|s| "locale:#{s}" }.join(" ")
    self.search_string += " root" if !self.settings['copy_id'] || (self.id && self.settings['copy_id'] == self.global_id)
    # self.settings['search_string'] = "#{self.settings['name']} locale:#{self.settings['locale'] || ''}".downcase
    # langs.each do |loc, txt|
    #   self.settings['search_string'] += "locale:#{loc}"
    # end
    # locs = {}
    # (BoardContent.load_content(board, 'translations') || {}).each do |attr, hash|
    #   if hash.is_a?(Hash)
    #     hash.each do |loc, vals|
    #       locs[loc] ||= ""
    #       if attr == 'board_name'
    #         locs[loc] += " #{vals}"
    #       elsif vals.is_a?(Hash) && vals['label']
    #         locs[loc] += " #{vals['label']}"
    #       end
    #     end
    #   end
    # end
    # self.settings['search_string'] += " #{self.key} #{self.labels} #{self.settings['description'] || ""}".downcase
    # search_string is limited to 4096
    # self.search_string = self.fully_listed? ? (self.settings['search_string'] || '')[0, 4096] : nil
    self.generate_stats unless self.settings['stars']
    true
  end
  
  def fully_listed?
    self.public && (!self.settings || !self.settings['unlisted'])
  end

  def unshareable?
    if self.settings && self.settings['protected']
      return true if self.settings['protected']['vocabulary']
    end
    false
  end
  
  def protected_material?
    if self.settings && self.settings['protected']
      return true if self.settings['protected']['media'] || self.settings['protected']['vocabulary']
    end
    false
  end

  def labels
    return @labels if @labels
    list = []
    grid = BoardContent.load_content(self, 'grid')
    buttons = self.buttons
    return "" if !grid || !buttons
    grid['columns'].times do |jdx|
      grid['rows'].times do |idx|
        id = grid['order'][idx] && grid['order'][idx][jdx]
        button = buttons.detect{|b| b['id'] == id }
        list.push(button['label']) if button && button['label']
      end
    end
    @labels = list.join(", ");
    return list.join(', ');
  end
  
  def current_revision
    self.attributes['current_revision'] || (self.settings && self.settings['revision_hashes'] && self.settings['revision_hashes'][-1] && self.settings['revision_hashes'][-1][0])
  end
  
  def full_set_revision
    self.settings['full_set_revision'] || self.current_revision || self.global_id
  end
  
  def populate_buttons_from_labels(labels, labels_order)
    labels_order ||= 'columns'
    max_id = self.buttons.map{|b| b['id'].to_i || 0 }.max || 0
    idx = 0
    buttons = self.buttons
    grid = BoardContent.load_content(self, 'grid')
    labels.split(/\n|,\s*/).each do |label|
      label.strip!
      next if label.blank?
      max_id += 1
      button = {
        'id' => max_id,
        'label' => label,
        'suggest_symbol' => true
      }
      buttons << button
      @buttons_changed = 'populated_from_labels'

      row = idx % grid['rows']
      col = (idx - row) / grid['rows']
      if labels_order == 'rows'
        col = idx % grid['columns']
        row = (idx - col) / grid['columns']
      end  

      if row < grid['rows'] && col < grid['columns']
        grid['order'][row][col] = button['id']
      end
      idx += 1
    end
    self.settings['grid'] = grid
    self.settings['buttons'] = buttons
  end
  
  def self.save_without_post_processing(board_ids)
    Board.find_all_by_global_id(board_ids).each do |board|
      board.save_without_post_processing if board
    end
  end
  
  def save_without_post_processing
    @skip_post_process = true
    self.save
    @skip_post_process = false
  end
  
  def post_process
    if @skip_post_process
      @skip_post_process = false
      return
    end
    
    rev = (((self.settings || {})['revision_hashes'] || [])[-2] || [])[0]
    notify('board_buttons_changed', {'revision' => rev, 'reason' => @buttons_changed}) if @buttons_changed && !@brand_new
    content_changed = @button_links_changed || @brand_new || @buttons_changed
    # Can't be backgrounded because board rendering depends on this
    self.map_images # NOTE: this clears @buttons_changed
    
    if self.settings && self.settings['image_url'] == DEFAULT_ICON && self.settings['default_image_url'] == self.settings['image_url'] && self.settings['name'] && self.settings['name'] != 'Unnamed Board'
      self.schedule(:check_image_url)
    end
    
    if @update_self_references
      self.update_self_references
    end

    
    if @check_for_parts_of_speech
      self.schedule(:check_for_parts_of_speech_and_inflections)
      @check_for_parts_of_speech = nil
    end

    if self.settings && self.settings['undeleted'] && (self.settings['image_urls'] || self.settings['sound_urls'])
      self.schedule(:restore_urls)
    end
    schedule(:update_affected_users, @brand_new) if content_changed

    schedule_downstream_checks
  end

  def check_inflections
    # this used to be a background job, but I think it needs to be part of the original save now
    if @check_for_parts_of_speech
      self.check_for_parts_of_speech_and_inflections(false)
      @check_for_parts_of_speech = nil
    end
  end

  def restore_urls
    (self.settings['image_urls'] || {}).each do |id, url|
      bi = ButtonImage.find_by_global_id(id)
      if !bi
        bi = ButtonImage.new
        hash = Board.id_pieces(id)
        @buttons_changed = true
        parts = id.split(/_/)
        bi.id = hash[:id]
        bi.nonce = hash[:nonce]
        bi.user_id = self.user_id
        bi.settings = {'avatar' => false, 'badge' => false, 'protected' => false, 'pending' => false}
        bi.url = url
        bi.save
      end
    end
    (self.settings['sound_urls'] || {}).each do |id, url|
      bs = ButtonSound.find_by_global_id(id)
      if !bs
        bs = ButtonSound.new
        hash = Board.id_pieces(id)
        @buttons_changed = true
        parts = id.split(/_/)
        bs.id = hash[:id]
        bs.nonce = hash[:nonce]
        bs.user_id = self.user_id
        bs.settings = {'protected' => false, 'pending' => false}
        bs.url = url
        bs.save
      end
    end
    self.settings.delete('undeleted')
    self.settings.delete('image_urls')
    self.settings.delete('sound_urls')
    @buttons_changed = true
    self.save
  end
  
  def update_self_references
    @update_self_references = false
    buttons = self.buttons || []
    self.using(:master).reload
    save_if_same_edit_key do
      self.settings['self_references_updated'] = true
      buttons.each do |button|
        if button['load_board'] && button['load_board']['id'] && button['load_board']['id'] == self.related_global_id(self.parent_board_id)
          button['load_board']['id'] = self.global_id
          button['load_board']['key'] = self.key
          @buttons_changed = 'updating_self_reference'
        end
      end
      self.settings['buttons'] = buttons
    end
  end
  
  def update_affected_users(is_new_board)
    # update user.sync_stamp based on UserBoardConnection 
    # (including supervisors of connected users)
    # TODO: sharding
    board_ids = [self.global_id]
    if is_new_board
      board_ids += (self.settings['immediately_upstream_board_ids'] || [])
    end
    # TODO: sharding
    ubcs = UserBoardConnection.where(:board_id => Board.local_ids(board_ids))
    root_users = ubcs.map(&:user).uniq.compact
    more_user_ids = root_users.map(&:supervisor_user_ids).flatten.uniq
    user_ids = root_users.map(&:global_id) + more_user_ids
    
    # TODO: sharding
    users = User.where(:id => User.local_ids(user_ids))
    # TODO: finer-grained control, user.sync_stamp instead of just user.updated_at
    users.find_in_batches(batch_size: 20) do |batch|
      batch.each{|user| user.save_with_sync('boards_changed') }
    end
    # when a new board is created, call user.track_boards on all affected users 
    # (i.e. users with a connection to an upstream board)
    if is_new_board
      users.each do |user|
        user.track_boards('schedule')
      end
    end
  end
  
  def check_image_url
    if self.settings && self.settings['image_url'] == DEFAULT_ICON && self.settings['default_image_url'] == self.settings['image_url'] && self.settings['name'] && self.settings['name'] != 'Unnamed Board'
      # TODO: include locale in search
      locale = (self.settings['locale'] || 'en').split(/-|_/)[0].downcase
      res = Typhoeus.get("https://www.opensymbols.org/api/v1/symbols/search?q=#{CGI.escape(self.settings['name'])}&locale=#{locale}", :timeout => 5, :ssl_verifypeer => false)
      results = JSON.parse(res.body) rescue nil
      results ||= []
      icon = results.detect do |result|
        result['license'] == "CC By" || result['repo_key'] == 'arasaac'
      end
      if icon && icon['image_url'] != DEFAULT_ICON
        # TODO race condition?
        self.update_setting({
          'image_url' => icon['image_url'],
          'default_image_url' => icon['image_url'],
          'default_image_details' => icon
        }, nil, :save_without_post_processing)
      end
    end
  end
  
  def map_images
    return unless @buttons_changed
    @buttons_changed = false
    @button_links_changed = false

    images = []
    sounds = []
    (self.buttons || []).each do |button|
      images << {:id => button['image_id'], :label => button['label']} if button['image_id']
      sounds << {:id => button['sound_id']} if button['sound_id']
    end
    
    found_images = BoardButtonImage.images_for_board(self.id)
    existing_image_ids = found_images.map(&:global_id)
    existing_images = existing_image_ids.map{|id| {:id => id} }
    image_ids = images.map{|i| i[:id] }
    new_images = images.select{|i| !existing_image_ids.include?(i[:id]) }
    orphan_images = existing_images.select{|i| !image_ids.include?(i[:id]) }
    BoardButtonImage.connect(self.id, new_images, :user_id => self.user.global_id)
    BoardButtonImage.disconnect(self.id, orphan_images)

    found_sounds = BoardButtonSound.sounds_for_board(self.id)
    existing_sound_ids = found_sounds.map(&:global_id)
    existing_sounds = existing_sound_ids.map{|id| {:id => id} }
    sound_ids = sounds.map{|i| i[:id] }
    new_sounds = sounds.select{|i| !existing_sound_ids.include?(i[:id]) }
    orphan_sounds = existing_sounds.select{|i| !sound_ids.include?(i[:id]) }
    BoardButtonSound.connect(self.id, new_sounds, :user_id => self.user.global_id)
    BoardButtonSound.disconnect(self.id, orphan_sounds)
    
    if new_images.length > 0 || new_sounds.length > 0 || orphan_images.length > 0 || orphan_sounds.length > 0
      protected_images = ButtonImage.find_all_by_global_id(image_ids).select(&:protected?)
#      protected_images = BoardButtonImage.images_for_board(self.id).select(&:protected?)
      protected_sounds = ButtonSound.find_all_by_global_id(sound_ids).select(&:protected?)
#      protected_sounds = BoardButtonSound.sounds_for_board(self.id).select(&:protected?)
    
      self.settings ||= {}
      if (protected_images + protected_sounds).length > 0 && (self.settings['protected'] || {})['media'] != true
        # TODO: race condition?
        sources = protected_images.map{|i| i.settings['protected_source'] || 'lessonpix' }
        sources += protected_sounds.map{|s| s.settings['protected_source'] }
        sources = sources.compact.uniq
        self.update_setting({
          'protected' => {'media' => true, 'media_sources' => sources}
        }, nil, :save_without_post_processing)
      elsif (protected_images + protected_sounds).length == 0 && self.settings['protected'] && self.settings['protected']['media'] == true
        # TODO: race condition?
        if self.settings['protected']
          self.update_setting({
            'protected' => {'media' => false, 'media_sources' => []}
          }, nil, :save_without_post_processing)
        end
      end
    end
    @images_mapped_at = Time.now.to_i
  end
  
  def require_key
    # TODO: truncate long names
    self.key ||= generate_board_key(self.settings && self.settings['name'])
    true
  end
  
  def cached_user_name
    (self.key || "").split(/\//)[0]
  end

  def buttons
    BoardContent.load_content(self, 'buttons')
  end
  
  def process_params(params, non_user_params)
    raise "user required as board author" unless self.user_id || non_user_params[:user]
    @edit_notes = []
    self.user ||= non_user_params[:user] if non_user_params[:user]
    
    self.settings ||= {}
    if !params['parent_board_id'].blank? && !self.parent_board_id
      parent_board = Board.find_by_global_id(params['parent_board_id'])
      if !parent_board
        add_processing_error('parent board not found')
        return false
      elsif parent_board.unshareable? && !non_user_params[:allow_copying_protected_boards]
        add_processing_error('cannot copy protected boards')
        return false
      end
      if self.parent_board_id != parent_board.id
        self.parent_board = parent_board
        BoardContent.apply_clone(parent_board, self) if parent_board.board_content_id
      end
    end
    self.settings['last_updated'] = Time.now.iso8601

    old_name = nil
    if params['locale']
      if self.settings['locale'] != params['locale']
        old_name = {locale: self.settings['locale'], name: self.settings['name']}
      end
      self.settings['locale'] = params['locale'] 
    end
    if !self.id && params['source_id']
      # check if the user has edit permission on the source, and only set this if so
      ref_board = Board.find_by_global_id(params['source_id'])
      if ref_board && ref_board.allows?(non_user_params[:user], 'edit')
        self.settings['copy_id'] ||= ref_board.settings['copy_id'] || ref_board.global_id
        self.settings['locale'] ||= ref_board.settings['locale']
      end
    end
    if !self.id && params['parent_board_id']
      self.settings['never_edited'] = true
    end

    @edit_notes << "renamed the board" if params['name'] && self.settings['name'] != params['name']
    self.settings['name'] = process_string(params['name']) if params['name']
    self.settings['word_suggestions'] = params['word_suggestions'] if params['word_suggestions'] != nil
    @edit_notes << "updated the description" if params['description'] && params['description'] != self.settings['description']
    self.settings['description'] = process_string(params['description']) if params['description']
    @edit_notes << "changed the image" if params['image_url'] && params['image_url'] != self.settings['image_url']
    self.settings['image_url'] = params['image_url'] if params['image_url']
    @edit_notes << "changed the background" if params['background'] && params['background'] != self.settings['background'].to_json
    self.settings['background'] = BoardContent.load_content(self, 'background')
    self.settings['background'] = params['background'] if params['background']
    if self.settings['background']
      self.settings['background']['delay_prompts'] ||= self.settings['background']['delayed_prompts'] if self.settings['background']['delayed_prompts']
      self.settings['background']['image'] ||= self.settings['background']['image_url'] if self.settings['background']['image_url']
      self.settings['background']['prompt'] ||= self.settings['background']['prompt_text'] if self.settings['background']['prompt_text']
    end

    if params['intro']
      self.settings['intro'] = params['intro'] 
      # When a board is copied and buttons change, the intro
      # should be marked unapproved until the user has manually
      # reviewed it.
      self.settings['intro']['unapproved'] = true if self.settings['never_edited'] && self.settings['intro'] && self.parent_board_id && params['intro']['unapproved'] != false
      self.settings['intro'].delete('unapproved') unless self.settings['intro']['unapproved']
    end
    self.settings['home_board'] = params['home_board'] if params['home_board'] != nil
    self.settings['categories'] = params['categories'] if params['categories']
    self.settings['hide_empty'] = params['hide_empty'] if params['hide_empty'] != nil
    self.settings['text_only'] = params['text_only'] if params['text_only'] != nil
    self.settings['never_edited'] = false if self.id
    process_buttons(params['buttons'], non_user_params[:user], non_user_params[:author], params['translations']) if params['buttons']
    prior_license = self.settings['license'].to_json
    process_license(params['license']) if params['license']
    @edit_notes << "changed the license" if self.settings['license'].to_json != prior_license

    if params['translations']
      self.settings['translations'] = BoardContent.load_content(self, 'translations') || {}
      self.settings['translations']['default'] = params['translations']['default']
      self.settings['translations']['current_label'] = params['locale'] || params['translations']['current_label']
      self.settings['translations']['current_vocalization'] = params['locale'] || params['translations']['current_vocalization']
      self.settings['translations']['board_name'] = params['translations']['board_name']
      if self.settings['name'] && params['locale']
        self.settings['translations']['board_name'] ||= {}
        self.settings['translations']['board_name'][params['locale']] = self.settings['name']
        if old_name
          self.settings['translations']['board_name'][old_name[:locale]] ||= old_name[:name]
        end
      end
    end
    self.star(non_user_params[:starrer], params['starred']) if params['starred'] != nil
    
    self.settings['grid'] = params['grid'] if params['grid']
    if params['visibility'] != nil
      if params['visibility'] == 'public'
        if !self.public || self.settings['unlisted']
          @edit_notes << "set to public"
          self.schedule_update_available_boards('all') if self.id
        end
        self.public = true
        self.settings['unlisted'] = false
      elsif params['visibility'] == 'unlisted'
        if !self.public || !self.settings['unlisted']
          @edit_notes << "set to unlisted"
          self.schedule_update_available_boards('all') if self.id
        end
        self.public = true
        self.settings['unlisted'] = true
      elsif params['visibility'] == 'private'
        if self.public
          @edit_notes << "set to private"
          self.schedule_update_available_boards('all') if self.id
        end
        self.public = false
        self.settings['unlisted'] = false
      end
    elsif params['public'] != nil
#       if self.public != false && params['public'] == false && (!self.user || !self.user.any_premium_or_grace_period?)
#         add_processing_error("only premium users can make boards private")
#         return false
#       end
      @edit_notes << "set to public" if !!params['public'] && !self.public
      @edit_notes << "set to private" if !params['public'] && self.public
      if self.public != !!params['public'] && self.id
        self.schedule_update_available_boards('all')
      end
      self.public = !!params['public'] 
    end
    if !params['sharing_key'].blank?
      return false unless self.process_share(params['sharing_key'])
    end
    non_user_params[:key] = nil if non_user_params[:key].blank?
    if non_user_params[:key]
      non_user_params[:key].sub!(/^tmp\//, '')
      non_user_params[:key] = nil if non_user_params[:key].match(/^tmp_/)
      self.key = generate_board_key(non_user_params[:key]) if non_user_params[:key]
    end

    if self.settings['undeleted']
      self.settings['image_urls'] = params['image_urls']
      self.settings['sound_urls'] = params['sound_urls']
    end
#    @edit_description = nil
    if self.id && @edit_notes.length > 0
      @edit_description = {
        'timestamp' => Time.now.to_f,
        'notes' => @edit_notes
      }
    end
    true
  end
  
  def categories
    res = (self.settings['categories'] || [])
    res << 'layout' if self.settings['layout_category']
    res
  end
    
  def check_for_parts_of_speech_and_inflections(do_save=true)
    if self.buttons
      any_changed = false
      trans = BoardContent.load_content(self, 'translations') || {}
      (self.settings['locales'] || [self.settings['locale']]).each do |loc|
        words_to_check = self.buttons.map{|b|
          btn = (trans[b['id'].to_s] || {})[loc] || b
          already_updated = btn['inflection_defaults'] && btn['inflection_defaults']['v'] == WordData::INFLECTIONS_VERSION
          already_updated = false if do_save == 'force'
          already_updated ? nil : (btn['vocalization'] || btn['label'])
        }.compact
        inflections = WordData.inflection_locations_for(words_to_check, loc)
        buttons = self.buttons.map do |button|
          if loc == self.settings['locale'] || !self.settings['locale']
            # look for part of speech when loading the default locale
            word = button['vocalization'] || button['label']
            if word && !button['part_of_speech']
              types = (inflections[word] || {})['types']
              types ||= (WordData.find_word(word) || {})['types'] || []
              if types && types.length > 0
                button['part_of_speech'] = types[0]
                button['suggested_part_of_speech'] = types[0]
                any_changed = true
              end
            elsif button['part_of_speech'] && button['part_of_speech'] == button['suggested_part_of_speech']
              types = (inflections[word] || {})['types']
              # if we've changed our assumption of the default, and the user hasn't updated
              # from what the system suggested, go ahead and update for them
              if types && types.length > 0 && types[0] != button['part_of_speech']
                button['part_of_speech'] = types[0]
                button['suggested_part_of_speech'] = types[0]
                any_changed = true
              end
            elsif button['part_of_speech'] && button['suggested_part_of_speech'] && button['part_of_speech'] != button['suggested_part_of_speech']
              str = "#{word}-#{button['part_of_speech']}"
              button['original_part_of_speech'] = button['suggested_part_of_speech']
              button.delete('suggested_part_of_speech')
              RedisInit.default.hincrby('overridden_parts_of_speech', str, 1) if RedisInit.default
            end
            # If there are any overrides compared to the javascript defaults,
            # persist them to the button object
            if word && inflections[word] && inflections[word]['v']
              button['inflection_defaults'] = inflections[word]
              any_changed = true
            end
          end
          btn = (trans[button['id'].to_s] || {})[loc]
          if btn && inflections[btn['vocalization'] || btn['label']] && inflections[btn['vocalization'] || btn['label']]['v']
            trans[button['id'].to_s][loc]['inflection_defaults'] = inflections[btn['vocalization'] || btn['label']]
            any_changed = true
          end
          button
        end
      end
      if any_changed
        self.settings['buttons'] = buttons 
        self.settings['translations'] = trans 
      end
      if any_changed && do_save
        self.assert_current_record!
        self.save 
      end
    end
  rescue ActiveRecord::StaleObjectError
    self.schedule_once(:check_for_parts_of_speech_and_inflections, do_save)
  end
  
  def process_button(button)
    buttons = self.buttons
    found_button = buttons.detect{|b| b['id'].to_s == button['id'].to_s }
    if button['sound_id']
      found_button['sound_id'] = button['sound_id']
      @buttons_changed = 'button updated in-place'
    end
    self.settings['buttons'] = buttons
#    self.schedule_once(:update_button_sets)
    self.save!
  end
  
  def update_button_sets
    upstreams = [self]
    visited_ids = []
    while upstreams.length > 0
      board = upstreams.shift
#      BoardDownstreamButtonSet.schedule_once(:update_for, board.global_id)
      visited_ids << board.global_id
      ups = Board.find_all_by_global_id(board.settings['immediately_upstream_board_ids'])
      ups.each do |up|
        if !visited_ids.include?(up.global_id)
          upstreams.push(up)
        end
      end
    end
  end
  
  def process_buttons(buttons, editor, secondary_editor=nil, translations=nil)
    translations ||= {}
    clear_cached("images_and_sounds_with_fallbacks")
    @edit_notes ||= []
    @check_for_parts_of_speech = true
    prior_buttons = self.buttons || []
    approved_link_ids = []
    new_link_ids = []
    prior_buttons.each do |button|
      if button['load_board']
        approved_link_ids << button['load_board']['id']
        approved_link_ids << button['load_board']['key']
      end
    end
    self.settings['buttons'] = buttons.map do |button|
      trans = button['translations'] || translations[button['id']] || translations[button['id'].to_s] || (BoardContent.load_content(self, 'translations') || {})[button['id'].to_s]
      button = button.slice('id', 'hidden', 'link_disabled', 'image_id', 'sound_id', 'label', 'vocalization', 
            'background_color', 'border_color', 'load_board', 'hide_label', 'url', 'apps', 'text_only', 
            'integration', 'video', 'book', 'part_of_speech', 'suggested_part_of_speech', 'external_id', 
            'painted_part_of_speech', 'add_to_vocalization', 'home_lock', 'blocking_speech', 'level_modifications', 'inflections');
      if button['load_board']
        if !approved_link_ids.include?(button['load_board']['id']) && !approved_link_ids.include?(button['load_board']['key'])
          link = Board.find_by_path(button['load_board']['id']) || Board.find_by_path(button['load_board']['key'])
          if !link || (!link.allows?(editor, 'view') && !link.allows?(secondary_editor, 'view'))
            button.delete('load_board')
          end
          new_link_ids << button['load_board']
        end
      end
      if trans
        self.settings['translations'] = BoardContent.load_content(self, 'translations') || {}
        trans.each do |loc, tran|
          if loc.is_a?(Hash)
            tran = loc
            loc = loc['locale']
          end
          next unless tran
          if loc == self.settings['locale']
            orig_button = (self.buttons || []).find{|b| b['id'] == button['id'] }
            # button settings overwrite translation settings for the default locale
            ['label', 'vocalization', 'inflections'].each do |k|
              if !orig_button || orig_button[k] != button[k]
                tran[k] = button[k] if button[k]
                tran.delete(k) if !button[k] && k != 'inflections'
              end
            end
          end
          loc = tran['locale'] || loc
          self.settings['translations'][button['id'].to_s] ||= {}
          self.settings['translations'][button['id'].to_s][loc] ||= {}
          self.settings['translations'][button['id'].to_s][loc]['label'] = tran['label'].to_s if tran['label']
          self.settings['translations'][button['id'].to_s][loc]['vocalization'] = tran['vocalization'].to_s if tran['vocalization'] || tran['label']
          self.settings['translations'][button['id'].to_s][loc].delete('vocalization') if self.settings['translations'][button['id'].to_s][loc]['vocalization'] == ""
          tran['inflections'].to_a.each_with_index do |str, idx|
            self.settings['translations'][button['id'].to_s][loc]['inflections'] ||= []
            self.settings['translations'][button['id'].to_s][loc]['inflections'][idx] = str.to_s if str
          end
          # ignore inflection_defaults, those should get re-added on their own
        end
      end
      if button['part_of_speech'] && button['part_of_speech'] == ''
        button.delete('part_of_speech')
      end
      if !button['load_board'] && !button['apps'] && !button['url'] && !button['video']
        button.delete('link_disabled')
      end
      button
    end
    # TODO: for each button use tinycolor to compute a "safe" color for border and bg,
    # also a hover color for each, and mark them as "server-side approved"

    if self.buttons.to_json != prior_buttons.to_json
      @edit_notes << "modified buttons"
      @buttons_changed = 'buttons processed' 
      @button_links_changed = true if new_link_ids.length > 0
    end
    self.buttons
  end
  
  def icon_url_or_fallback
    fallback = DEFAULT_ICON
    self.settings['image_url'].blank? ? fallback : self.settings['image_url']
  end
  
  def rollback_board_set(date)
    boards = [self]
    downstreams = self.settings['downstream_board_ids']
    downs = Board.find_all_by_global_id(downstreams).select{|b| b.cached_user_name == self.cached_user_name }
    boards += downs
    boards.each do |board|
      puts "rolling back #{board.key} to #{date.to_s}"
      begin 
        board.rollback_to(date) 
      rescue => e
        puts "  rollback error, #{e.to_s}"
      end
    end
  end
  
  def flush_related_records
    DeletedBoard.process(self)
  end
  
  def images_and_sounds_for(user)
    # TODO: this is silly, it won't repeat often enough for a cache. We need to cache it
    # on the board, but not the user, and include both the protected URL and the fallback
    # and then in-process we can decide which one to show. Even that won't be too 
    # often but at least it'll work across users
    # TODO: can we cache both the protected URL and the fallback on the db record itself,
    # based on boards_updated_at, and then we could skip the lookup entirely 
    # (how long is the lookup taking??? is this worth the effort?)
    # list_key = "images_and_sounds_with_fallbacks"
    key = "images_and_sounds_for/#{user ? user.cache_key : 'nobody'}"
    res = get_cached(key)
    return res if res
    Rails.logger.warn('start images_and_sounds lookup')
    res = {}
    bis = self.button_images
    protected_sources = (user && user.enabled_protected_sources(true)) || []
    ButtonImage.cached_copy_urls(bis, user, nil, protected_sources)
    # JsonApi::Image.as_json(i, :original_and_fallback => true).slice('id', 'url', 'fallback_url', 'protected_source'))
    res['images'] = bis.map{|i| JsonApi::Image.as_json(i, :allowed_sources => protected_sources) }
    if (self.buttons || []).detect{|b| b && b['sound_id']}
      res['sounds'] = self.button_sounds.map{|s| JsonApi::Sound.as_json(s) }#.slice('id', 'url') }
    else
      res['sounds'] = []
    end
    # set_cached(list_key, res.to_json)
    # res['images'].each do |img|
    #   if img['protected_source'] && !protected_sources.include?(img['protected_source'])
    #     img['url'] = img['fallback_url']
    #     img['protected'] = false
    #     img['fallback'] = true
    #   end
    #   img.delete('fallback_url')
    # end
    Rails.logger.warn('end images_and_sounds lookup')
    set_cached(key, res)
    res
  end

  def translate_set(translations, opts)
    allow_fallbacks = opts['allow_fallbacks']
    source_lang = opts['source']
    dest_lang = opts['dest']
    board_ids = opts['board_ids']
    set_as_default = opts['default'] != false
    user_for_paper_trail = opts['user_key']
    user_local_id = opts['user_local_id']
    visited_board_ids = opts['visited_board_ids'] || []

    user_local_id ||= self.user_id
    source_lang = 'en' if source_lang.blank?
    label_lang = dest_lang
    vocalization_lang = dest_lang
    return {done: true, translated: false, reason: 'mismatched user'} if user_local_id != self.user_id
    set_as_default_here = !!set_as_default
    set_as_default_here = false if self.settings['locale'] == label_lang
    if board_ids.blank? || board_ids.include?(self.global_id)
      self.settings['translations'] = BoardContent.load_content(self, 'translations') || {}
      self.settings['translations']['board_name'] ||= {}
      if self.settings['name'] && self.settings['name'] != "Unnamed Board"
        self.settings['translations']['board_name'][source_lang] ||= self.settings['name']
        self.settings['translations']['board_name'][dest_lang] = translations[self.settings['name']] if translations[self.settings['name']]
      end
      if self.settings['name'] && translations[self.settings['name']] && set_as_default_here
        self.settings['name'] = translations[self.settings['name']]
      end
      self.settings['locale'] ||= source_lang
      self.settings['translations']['default'] ||= source_lang
      self.settings['translations']['current_label'] ||= source_lang
      self.settings['translations']['current_vocalization'] ||= source_lang
      if set_as_default_here
        self.settings['locale'] = label_lang
        self.settings['translations']['current_label'] = label_lang
        self.settings['translations']['current_vocalization'] = vocalization_lang
      end
      buttons = self.buttons
      buttons = self.buttons.map do |button|
        button = button.dup
        if button['label'] && translations[button['label']]
          self.settings['translations'][button['id'].to_s] ||= {}
          self.settings['translations'][button['id'].to_s][source_lang] ||= {}
          self.settings['translations'][button['id'].to_s][source_lang]['label'] ||= button['label']
          self.settings['translations'][button['id'].to_s][dest_lang] ||= {}
          self.settings['translations'][button['id'].to_s][dest_lang]['label'] = translations[button['label']]
          button['label'] = translations[button['label']] if set_as_default_here
          @buttons_changed = 'translated'
        elsif allow_fallbacks && set_as_default_here
          fallback = ((self.settings['translations'][button['id'].to_s] || {})[dest_lang] || {})['label']
          if fallback
            button['label'] = fallback 
            @buttons_changed = 'translated'
          elsif button['label']
            button.delete('label')
            @buttons_changed = 'translated'
          end
        end
        if button['vocalization'] && translations[button['vocalization']]
          self.settings['translations'][button['id'].to_s] ||= {}
          self.settings['translations'][button['id'].to_s][source_lang] ||= {}
          self.settings['translations'][button['id'].to_s][source_lang]['vocalization'] ||= button['vocalization']
          self.settings['translations'][button['id'].to_s][dest_lang] ||= {}
          self.settings['translations'][button['id'].to_s][dest_lang]['vocalization'] = translations[button['vocalization']]
          button['vocalization'] = translations[button['vocalization']] if set_as_default_here
          @buttons_changed = 'translated'
        elsif  allow_fallbacks && set_as_default_here
          fallback = ((self.settings['translations'][button['id'].to_s] || {})[dest_lang] || {})['vocalization']
          if fallback
            button['vocalization'] = fallback 
            @buttons_changed = 'translated'
          elsif button['vocalization']
            button.delete('vocalization')
            @buttons_changed = 'translated'
          end
        end
        if allow_fallbacks && set_as_default_here
          fallback = ((self.settings['translations'][button['id'].to_s] || {})[dest_lang] || {})['inflections']
          if fallback
            button['inflections'] = fallback 
            @buttons_changed = 'translated'
          elsif button['inflections']
            button.delete('inflections')
            @buttons_changed = 'translated'
          end
        end
        button
      end
      if @buttons_changed
        self.settings['buttons'] = buttons
      end
      whodunnit = PaperTrail.request.whodunnit
      PaperTrail.request.whodunnit = user_for_paper_trail.to_s || 'user:unknown'
      self.save
      PaperTrail.request.whodunnit = whodunnit
      if self.public
        # When a board is translated, pass the new strings
        # along to opensymbols
        images_to_track = []
        images_hash = {}
        self.button_images.each{|i| images_hash[i.global_id] = i.settings['external_id'] }
        inverted_translations = translations.invert
        self.settings['buttons'].each do |button|
          string_to_track = button['label'] && translations[button['label']]
          string_to_track ||= inverted_translations[button['label']] && button['label']
          if string_to_track && button['image_id'] && images_hash[button['image_id']]
            images_to_track << {
              :id => button['image_id'], 
              :label => string_to_track, 
              :user_id => self.user.global_id,
              :external_id => images_hash[button['image_id']],
              :locale => dest_lang
            }
          end
        end
        ButtonImage.track_images(images_to_track)
      end
    else
      return {done: true, translated: false, reason: 'board not in list'}
    end
    visited_board_ids << self.global_id
    downstreams = self.settings['immediately_downstream_board_ids'] - visited_board_ids
    Board.find_all_by_path(downstreams).each do |brd|
      brd.translate_set(translations, {
        'source' => source_lang,
        'dest' => dest_lang,
        'board_ids' => board_ids,
        'default' => set_as_default,
        'user_key' => user_for_paper_trail,
        'user_local_id' => user_local_id,
        'allow_fallbacks' => allow_fallbacks,
        'visited_board_ids' => visited_board_ids
      })
      visited_board_ids << brd.global_id
    end
    {done: true, translations: translations, d: dest_lang, s: source_lang, board_ids: board_ids, updated: visited_board_ids}
  end
  
  def swap_images(library, author, board_ids, user_local_id=nil, visited_board_ids=[], updated_board_ids=[])
    author = User.find_by_global_id(author) if author && author.is_a?(String)
    user_local_id ||= self.user_id
    return {done: true, swapped: false, reason: 'mismatched user'} if user_local_id != self.user_id
    return {done: true, swapped: false, reason: 'no library specified'} if !library || library.blank?
    return {done: true, swapped: false, reason: 'author required'} unless author
    return {done: true, swapped: false, reason: 'not authorized to access premium library'} if library == 'pcs' && (!author || !author.subscription_hash['extras_enabled'])
    return {done: true, swapped: false, reason: 'not authorized to access premium library'} if library == 'symbolstix' && (!author || !author.subscription_hash['extras_enabled'])
    return {done: true, swapped: false, reason: 'not authorized to access premium library'} if library == 'lessonpix' && (!author || !author.subscription_hash['extras_enabled']) && !Uploader.lessonpix_credentials(author)
    if (board_ids.blank? || board_ids.include?(self.global_id))
      updated_board_ids << self.global_id
      words = self.buttons.map{|b| [b['label'], b['vocalization']] }.flatten.compact.uniq
      defaults = Uploader.default_images(library, words, self.settings['locale'] || 'en', author)
      buttons = self.buttons.map do |button|
        if button['label'] || button['vocalization']
          image_data = defaults[button['label'] || button['vocalization']]
          image_data ||= (Uploader.find_images(button['label'] || button['vocalization'], library, author, nil, true) || [])[0]
          if image_data
            image_data['button_label'] = button['label']
            bi = ButtonImage.process_new(image_data, {user: author})
            button['image_id'] = bi.global_id
            @buttons_changed = 'swapped images'
          end
        end
        button
      end
      whodunnit = PaperTrail.request.whodunnit
      PaperTrail.request.whodunnit = "user:#{author.global_id}.board.swap_images"
      if @buttons_changed
        self.settings['buttons'] = buttons
        self.save 
      end
      PaperTrail.request.whodunnit = whodunnit
    else
      return {done: true, swapped: false, reason: 'board not in list'}
    end
    visited_board_ids << self.global_id
    downstreams = self.settings['immediately_downstream_board_ids'] - visited_board_ids
    Board.find_all_by_path(downstreams).each do |brd|
      if board_ids.instance_variable_get('@skip_keyboard') && brd.key.match(/keyboard$/)
        # When swapping images, don't touch the keyboards, 
        # there's no point and the pic will get weird via search
      else
        brd.swap_images(library, author, board_ids, user_local_id, visited_board_ids, updated_board_ids)
      end
      visited_board_ids << brd.global_id
    end
    {done: true, library: library, board_ids: board_ids, visited: visited_board_ids.uniq, updated: updated_board_ids.uniq}
  end  
  
  def default_listeners(notification_type)
    if notification_type == 'board_buttons_changed'
      ubc = UserBoardConnection.where(:board_id => self.id)
      direct_users = ubc.map(&:user).compact
      supervisors = direct_users.map(&:supervisors).flatten
      (direct_users + supervisors).uniq.map(&:record_code)
    else
      []
    end
  end
  
  def additional_webhook_record_codes(notification_type, additional_args)
    if notification_type == 'button_action' && additional_args && additional_args['button_id']
      button = (self.buttons || []).detect{|b| b['id'].to_s == additional_args['button_id'].to_s }
      user = additional_args && User.find_by_path(additional_args['user_id'])
      res = []
      if button && button['integration'] && button['integration']['user_integration_id'] && self.allows?(user, 'view')
        ui = UserIntegration.find_by_path(button['integration']['user_integration_id'])
        res << ui.record_code if ui && ui.settings['button_webhook_url']
      end
      res
    else
      []
    end
  end
  
  def webhook_content(notification_type, content_type, additional_args)
    if notification_type == 'button_action' && additional_args && additional_args['button_id']
      button = (self.buttons || []).detect{|b| b['id'].to_s == additional_args['button_id'].to_s }
      res = {}
      user = additional_args && User.find_by_path(additional_args['user_id'])
      if button && button['integration'] && button['integration']['user_integration_id'] && self.allows?(user, 'view')
        ui = UserIntegration.find_by_path(button['integration']['user_integration_id'])
        associated_user = additional_args && User.find_by_path(additional_args['associated_user_id'])
        associated_user = nil if associated_user && !associated_user.allows?(user, 'model')
        if ui && ui.settings['button_webhook_url']
          placement_code = ui.placement_code(self.global_id, button['id'].to_s)
          ref_user = associated_user || user
          user_code = ui.placement_code(ref_user ? ref_user.global_id : "nobody")
          res = {
            'action' => button['integration']['action'],
            'placement_code' => placement_code,
            'user_code' => ref_user ? user_code : nil
          }
          if user && ui.allow_private_information?
            res['user_id'] = user.global_id
            res['board_id'] = board.global_id
            res['button_id'] = button['id']
            res['associated_user_id'] = associated_user.global_id if associated_user
          end
        end
      end
      res.to_json
    else
      {}.to_json
    end
  end
end
