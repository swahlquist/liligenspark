module Sharing
  extend ActiveSupport::Concern
  
  def process_share(sharing_key)
    action, user_name = sharing_key.split(/-/, 2)
    user = User.find_by_path(user_name)
    if !user
      add_processing_error("user #{user_name} not found while trying to share")
      return false
    elsif self.unshareable?
      # TODO: if sharing with a supervisor, it's ok
      add_processing_error("user #{user_name} does not have access to the protected material on this board")
      return false
      sources = self.settings['protected']['media_sources'] || ['lessonpix']
      user_sources = (user && user.enabled_protected_sources) || []
      if (user_sources & sources) != sources
        add_processing_error("user #{user_name} does not have access to the protected material on this board")
        return false
      end
    end
    if action == 'add_deep'
      return self.share_with(user, true)
    elsif action == 'add_shallow'
      return self.share_with(user, false)
    elsif action == 'add_edit_deep'
      return self.share_with(user, true, true)
    elsif action == 'add_edit_shallow'
      return self.share_with(user, false, true)
    elsif action == 'remove'
      return self.unshare_with(user)
    end
    true
  end
  
  def author?(user)
    self.author_ids.include?(user.global_id)
  end
  
  def share_ids
    links = UserLink.links_for(self).select{|l| l['type'] == 'board_share' }
    res = []
    res << self.related_global_id(self.user_id) if self.user_id
    links.each do |link|
      res << link['user_id']
    end
    res
  end
  
  def downstream_share_ids
    links = UserLink.links_for(self).select{|l| l['type'] == 'board_share' }
    res = []
    res << self.related_global_id(self.user_id) if self.user_id
    links.each do |link|
      res << link['user_id'] if link['state'] && link['state']['include_downstream'] && !link['state']['pending']
    end
    res
  end
  
  def author_ids(plus_downstream_editing=false)
    links = UserLink.links_for(self).select{|l| l['type'] == 'board_share' }
    res = []
    res << self.related_global_id(self.user_id) if self.user_id
    links.each do |link|
      if plus_downstream_editing
        res << link['user_id'] if link['state'] && link['state']['allow_editing'] && link['state']['include_downstream'] && !link['state']['pending']
      else
        res << link['user_id'] if link['state'] && link['state']['allow_editing']
      end
    end
    res
  end
  
  def share_with(user, include_downstream=false, allow_editing=false)
    share_or_unshare(user, true, :include_downstream => include_downstream, :allow_editing => allow_editing)
  end
  
  def shared_by?(user)
    links = UserLink.links_for(self).select{|l| l['type'] == 'board_share' }
    links.any?{|link| link['state'] && link['state']['sharer_id'] == user.global_id }
#    !!(user.settings['boards_i_shared'] && user.settings['boards_i_shared'][self.global_id] && user.settings['boards_i_shared'][self.global_id].length > 0)
  end
  
  def share_or_unshare(user, do_share, args={})
    include_downstream = !!args[:include_downstream]
    allow_editing = !!args[:allow_editing]
    pending = false
    if allow_editing && include_downstream
      pending = args[:pending_allow_editing] == nil ? true : !!args[:pending_allow_editing]
    end
    author = self.user
    raise "user required" unless user
    user = author if author.id == user.id
    if do_share
      link = UserLink.generate(user, self, 'board_share')
      link.data['state']['sharer_id'] = author.global_id
      link.data['state']['sharer_user_name'] = author.user_name
      link.data['state']['include_downstream'] = true if include_downstream
      link.data['state']['allow_editing'] = true if allow_editing
      link.data['state']['pending'] = pending
      link.data['state']['board_key'] = self.key
      link.data['state']['user_name'] = user.user_name
      link.secondary_user_id = author.id
      link.save
    else
      UserLink.remove(user, self, 'board_share')
      author.settings ||= {}
      if author.settings['boards_i_shared']
        author.settings['boards_i_shared'] ||= {}
        list = [] + (author.settings['boards_i_shared'][self.global_id] || []).select{|share| share['user_id'] != user.global_id }
  #       if do_share
  #         list << {
  #           'user_id' => user.global_id,
  #           'user_name' => user.user_name,
  #           'include_downstream' => include_downstream,
  #           'allow_editing' => allow_editing,
  #           'pending' => !!pending
  #         }
  #       end
        author.settings['boards_i_shared'][self.global_id] = list
        author.save
      end
      
      if user.settings['boards_shared_with_me']
        user.settings ||= {}
        list = [] + (user.settings['boards_shared_with_me'] || []).select{|share| share['board_id'] != self.global_id }
  #       if do_share
  #         list << {
  #           'board_id' => self.global_id,
  #           'board_key' => self.key,
  #           'include_downstream' => include_downstream,
  #           'allow_editing' => allow_editing,
  #           'pending' => !!pending
  #         }
  #       end
        user.settings['boards_shared_with_me'] = list
        user.save_with_sync('share')
      end
    end
    self.schedule_update_available_boards('all')
    schedule(:touch_downstreams)
    true
  end
  
  def update_shares_for(user, approve)
    user_ids = self.shared_user_ids
    if user && user_ids.include?(user.global_id)
      share_or_unshare(user, approve, :include_downstream => true, :allow_editing => true, :pending_allow_editing => false)
    else
      false
    end
  end
  
  def unshare_with(user)
    share_or_unshare(user, false)
  end
  
  def shared_user_ids
    links = UserLink.links_for(self).select{|l| l['type'] == 'board_share' }
    links.map{|l| l['user_id'] }.uniq
#     author = self.user
#     list = ((author.settings || {})['boards_i_shared'] || {})[self.global_id] || []
#     user_ids = list.map{|s| s['user_id'] }
  end
  
  def shared_users
    links = UserLink.links_for(self).select{|l| l['type'] == 'board_share' }
    user_ids = links.map{|l| l['user_id'] }.uniq
    users = User.find_all_by_global_id(user_ids)
    result = []
    links.each do |share|
      user = users.detect{|u| u.global_id == share['user_id'] }
      if user
        user_hash = JsonApi::User.as_json(user, :limited_identity => true)
        user_hash['include_downstream'] = !!share['state']['include_downstream']
        user_hash['allow_editing'] = !!share['state']['allow_editing']
        user_hash['pending'] = !!share['state']['pending']
        result << user_hash
      end
    end
    result
  end
  
  def shared_with?(user, plus_editing=false)
    return false unless self.id
    links = UserLink.links_for(self).select{|l| l['type'] == 'board_share' }
    return false unless links.length
    shares = links.select{|l| l['user_id'] == user.global_id}
    shared = false
    if plus_editing
      shared = shares.any?{|s| s['state']['allow_editing'] }
    else
      shared = shares.length > 0
    end
    if !shared
      all_board_ids = self.class.all_shared_board_ids_for(user, plus_editing)
      shared = all_board_ids.include?(self.global_id)
    end
    shared
  end
  
  module ClassMethods
    def all_shared_board_ids_for(user, plus_editing=false)
      user.settings['all_shared_board_ids'] ||= {}
      sub_key = plus_editing ? 'editing' : 'viewing'
      if user.settings['all_shared_board_ids'][sub_key] && user.settings['all_shared_board_ids'][sub_key]['timestamp'] >= user.boards_updated_at.to_f.round(2)
        return user.settings['all_shared_board_ids'][sub_key]['list']
      end
      links = UserLink.links_for(user).select{|l| l['type'] == 'board_share' }
      return [] if links.length == 0
      
#      cached = user.get_cached("all_shared_board_ids/#{plus_editing}")
#      return cached if cached

      # all explicitly-shared boards
      shallow_board_ids = links.select{|l| plus_editing ? (l['state'] && l['state']['allow_editing']) : true }.map{|l| l['record_code'].split(/:/)[1] }

      # all explicitly-shared boards that are set to include downstream
      deep_board_shares = links.select{|l| plus_editing ? (l['state'] && l['state']['allow_editing'] && !l['state']['pending']) : true }.select{|l| l['state'] && l['state']['include_downstream'] }
      # sharing right now assumes that the board author will be the source of all shares
      deep_board_shares += links.select{|l| l['state'] && l['state']['sharer_id'] == user.global_id &&  l['state']['include_downstream'] && l['state']['allow_editing'] && !l['state']['pending'] }
      deep_board_ids = deep_board_shares.map{|l| l['record_code'].split(/:/)[1] }.uniq
      
      # get all those boards
      boards = Board.find_all_by_global_id(deep_board_ids)
      valid_deep_board_authors = {}
      # for each explicitly-shared including-downstream board, mark all downstream boards
      # as possibly-shared if they were authored by any of the root board's authors
      boards.each do |b| 
        b.author_ids(plus_editing).each do |author_id|
          valid_deep_board_authors[b.global_id] ||= []; valid_deep_board_authors[b.global_id] << author_id
          (b.settings['downstream_board_ids'] || []).each do |id|
            valid_deep_board_authors[id] ||= []; valid_deep_board_authors[id] << author_id
          end
        end
      end
      # get the list of all possible downstream boards
      all_deep_board_ids = boards.map{|b| b.settings['downstream_board_ids'] || [] }.flatten.compact.uniq
      
      valid_deep_board_ids = []
      # for every downstream board, mark it as shared if one of the current board's authors
      # matches one of the root-board authors, which would implicitly grant access
      Board.find_all_by_global_id(all_deep_board_ids).each do |b|
        b.author_ids.each do |author_id|
          valid_deep_board_ids << b.global_id if valid_deep_board_authors[b.global_id].include?(author_id)
        end
      end
      
      all_board_ids = (shallow_board_ids + valid_deep_board_ids).uniq

#      user.set_cached("all_shared_board_ids/#{plus_editing}", all_board_ids)
      user.boards_updated_at = Time.now
      user.settings['all_shared_board_ids'][sub_key] = {
        'timestamp' => user.boards_updated_at.to_f.round(2),
        'list' => all_board_ids
      }
      user.save(touch: false)

      all_board_ids
    end
  end
end