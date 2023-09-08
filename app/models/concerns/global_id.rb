module GlobalId
  extend ActiveSupport::Concern

  def global_id(actual=false)
    if self.class.protected_global_id
      if self.nonce == 'legacy'
        self.id ? "1_#{self.id}" : nil
      else
        self.id ? "1_#{self.id}_#{self.nonce}" : nil
      end
    else
      res = self.id ? "1_#{self.id}" : nil
      if !actual
        if @sub_id && res
          res += "-" + @sub_id
        end
      end
      res
    end
  end
  
  def related_global_id(id)
    id ? "1_#{id}" : nil
  end
  
  def generate_nonce_if_protected
    if self.class.protected_global_id
      self.nonce ||= GoSecure.nonce('security_nonce')
    end
    true
  end

  module ClassMethods
    def protect_global_id
      self.protected_global_id = true
    end

    def find_by_global_id(id)
      pieces = id_pieces(id)
      sub_user = nil
      if self == Board && pieces && pieces[:sub_id]
        sub_user = User.find_by_global_id(pieces[:sub_id][:orig])
        return nil unless sub_user
        extra = UserExtra.find_by(user_id: pieces[:sub_id][:id])
        if extra && extra.settings && extra.settings['replaced_boards']
          if extra.settings['replaced_boards'][pieces[:orig]]
            pieces = id_pieces(extra.settings['replaced_boards'][pieces[:orig]])
            sub_user = nil
          end
        end
      end
      res = find_by(:id => pieces[:id])
      if self.protected_global_id && res
        res = nil if !pieces[:nonce] && (!res || res.nonce != "legacy")
        res = nil if res && res.nonce != pieces[:nonce] && res.nonce != "legacy"
      end
      if sub_user && res
        res.instance_variable_set('@sub_id', sub_user.global_id)
        res.instance_variable_set('@sub_global', sub_user)
      end
      res
    end
    
    def local_ids(ids)
      any_sub_ids = ids.detect{|id| id.match(/-/) }
      raise "not allowed for protected record types" if self.protected_global_id
      if any_sub_ids
        new_ids = []
        sub_ids = []        
        piece_list = ids.map{|id| id_pieces(id) }
        piece_list.each do |h|
          if h[:sub_id]
            sub_ids << h[:sub_id][:id]
          end
        end
        sub_users = {}
        User.where(id: sub_ids).preload(:user_extra).each do |user|
          sub_users[user.id.to_s] = user
        end
        piece_list.each do |h|
          if h[:sub_id]
            if sub_users[h[:sub_id][:id]]
              ue = sub_users[h[:sub_id][:id]].user_extra
              if ue && ue.settings['replaced_boards'] && ue.settings['replaced_boards'][h[:orig]]
                new_ids << ue.settings['replaced_boards'][h[:orig]]
              else
                new_ids << h[:orig]
              end
            end
          else
            new_ids << h[:orig]
          end
        end
        ids = new_ids.uniq
      end
      ids.select{|id| id.match(/^\d+_/) }.map{|id| id.split(/_/)[1] }
    end
    
    def id_pieces(id)
      parts = id.to_s.split(/-/)
      shard, db_id, nonce = (parts[0] || '').split(/_/); 

      res = {:orig => parts[0], :shard => shard, :id => db_id, :nonce => nonce}
      res[:sub_id] = id_pieces(parts[1]) if parts[1]
      res
    end
    
    def find_all_by_global_id(ids)
      ids = ids.compact
      return [] if !ids || ids.length == 0
      id_hashes = (ids || []).map{|id| id_pieces(id) }
      sub_ids = id_hashes.map{|h| h[:sub_id] && h[:sub_id][:id] }.compact.uniq
      sub_users = {}
      User.where(id: sub_ids).preload(:user_extra).each do |user|
        sub_users[user.id.to_s] = user
      end
      users_for = {}

      # Check for any ids that have sub_id defined and look up replacements
      id_hashes = id_hashes.map do |h|
        res = h
        users_for[res[:id]] ||= []
        if h[:sub_id]
          u = sub_users[h[:sub_id][:id].to_s]
          if u && u.user_extra && u.user_extra.settings && u.user_extra.settings['replaced_boards'] && u.user_extra.settings['replaced_boards'][h[:orig]]
            res = id_pieces(u.user_extra.settings['replaced_boards'][h[:orig]])
            # id_hashes << res
            users_for[res[:id]] ||= []
            users_for[res[:id]] << nil
          elsif u
            users_for[res[:id]] << u
          end
        else
          users_for[res[:id]] << nil
        end
        users_for.each{|id, list| list.uniq! }
        res
      end

      res = self.where(:id => id_hashes.map{|h| h[:id] }).to_a
      if self.protected_global_id
        res = res.select do |record|
          hash = id_hashes.detect{|h| h[:id] == record.id.to_s }
          hash && (record.nonce == 'legacy' || hash[:nonce] == record.nonce)
        end
      elsif self == Board && id_hashes.any?{|h| h[:sub_id] }
        new_res = []
        res.each do |record|
          users = users_for[record.id.to_s].uniq
          if users && users.length == 1
            if users[0]
              record.instance_variable_set('@sub_id', users[0].global_id)
              record.instance_variable_set('@sub_global', users[0])
            end
            new_res << record
          elsif !users || users.length < 1
            new_res << record
          else
            # If there are multiple global_ids for the same record but with different sub_ids
            # then they should each be returned individually
            new_res << record if users.any?{|u| !u }
            users.each do |u|
              if u
                rec = record.clone
                rec.instance_variable_set('@sub_id', u.global_id)
                rec.instance_variable_set('@sub_global', u)
                new_res << rec
              end
            end
          end
        end
        res = new_res
      end
      res
    end
    
    def find_batches_by_global_id(ids, opts={}, &block)
      ids = ids.compact if ids
      batch = (opts && opts[:batch_size]) || 10
      return [] if !ids || ids.length == 0
      id_hashes = (ids || []).map{|id| id_pieces(id) }
      sub_ids = id_hashes.map{|h| h[:sub_id] && h[:sub_id][:id] }.compact.uniq
      sub_users = {}
      User.where(id: sub_ids).preload(:user_extra).each do |user|
        sub_users[user.id.to_s] = user
      end

      users_for = {}

      # Check for any ids that have sub_id defined and look up replacements
      id_hashes = id_hashes.map do |h|
        res = h
        if h[:sub_id]
          u = sub_users[h[:sub_id][:id]]
          users_for[res[:id]] ||= []
          if u && u.user_extra && u.user_extra.settings && u.user_extra.settings['replaced_boards'] && u.user_extra.settings['replaced_boards'][h[:orig]]
            res = id_pieces(u.user_extra.settings['replaced_boards'][h[:orig]])
            users_for[res[:id]] ||= []
            users_for[res[:id]] << nil
          elsif u
            users_for[res[:id]] << u
          end
        else
          users_for[res[:id]] ||= []
          users_for[res[:id]] << nil
        end
        users_for.each{|id, list| list.uniq! }
        res
      end

      self.where(:id => id_hashes.map{|h| h[:id] }).find_in_batches(batch_size: batch) do |batch|
        batch.each do |obj|
          if self.protected_global_id
            hash = id_hashes.detect{|h| h[:id] == obj.id.to_s }
            if hash && (record.nonce == 'legacy' || hash[:nonce] == record.nonce)
              block.call(obj)
            end
          elsif self == Board && id_hashes.any?{|h| h[:sub_id] }
            users = users_for[obj.id.to_s].uniq
            if users && users.length == 1
              if users[0]
                obj.instance_variable_set('@sub_id', users[0].global_id)
                obj.instance_variable_set('@sub_global', users[0])
              end
              block.call(obj)
            elsif !users || users.length < 1
              block.call(obj)
            else
              # If there are multiple global_ids for the same record but with different sub_ids
              # then they should each be returned individually
              block.call(obj) if users.any?{|u| !u }
              users.each do |u|
                if u
                  rec = obj.clone
                  rec.instance_variable_set('@sub_id', u.global_id)
                  rec.instance_variable_set('@sub_global', u)
                  block.call(rec)
                end
              end
            end
          else
            block.call(obj)
          end
        end
      end
    end

    def find_by_path(path)
      return nil unless path
      if self == Board && path.to_s.match(/\//)
        if path.to_s.match(/\/my:/)
          user_name, after_matter = path.to_s.split(/\/my:/, 2)
          orig_path = after_matter.sub(/:/, '/').downcase
          user = User.find_by_path(user_name)
          return nil unless user
          ue = user && user.user_extra
          res = nil
          if ue && ue.settings && ue.settings['replaced_boards'] && ue.settings['replaced_boards'][orig_path.downcase]
            res = find_by_global_id(ue.settings['replaced_boards'][orig_path.downcase])
            user = nil
          else
            res = find_by(:key => orig_path)
          end
          return nil unless res
          if user
            res.instance_variable_set('@sub_id', user.global_id)
            res.instance_variable_set('@sub_global', user)
          end
          res
        else
          find_by(:key => path.downcase)
        end
      elsif self == User && !path.to_s.match(/^\d/)
        find_by(:user_name => path.downcase)
      else
        find_by_global_id(path)
      end
    end

    def find_all_by_path(paths)
      global_ids = []
      keys = []
      user_names = []
      sub_users = {}
      if paths.any?{|p| p && p.match(/\/my:/)} 
        sub_names = paths.map{|p| p.match(/\/my:/) && p.split(/\/my:/)[0] }.compact.uniq
        User.where(user_name: sub_names).preload(:user_extra).each do |user|
          sub_users[user.user_name] = user
        end
      end
      sub_keys = []
      sub_key_users = {}
      paths.each do |path|
        if self == Board && path.to_s.match(/\//)
          raise "not allowed on protected records" if self.protected_global_id
          if path.match(/\/my:/)
            user_name, after_matter = path.to_s.split(/\/my:/, 2)
            orig_path = after_matter.sub(/:/, '/').downcase
            orig_un = after_matter.split(/:/)[0]
            if sub_users[user_name]
              ue = sub_users[user_name].user_extra
              if ue && ue.settings['replaced_boards'] && ue.settings['replaced_boards'][orig_path]
                global_ids << ue.settings['replaced_boards'][orig_path]
              else
                sub_keys << orig_path.downcase
                sub_key_users[orig_path.downcase] ||= []
                sub_key_users[orig_path.downcase] << sub_users[user_name]
              end
            end
          else
            keys << path.downcase
          end
        elsif self == User && !path.to_s.match(/^\d/)
          raise "not allowed on protected records" if self.protected_global_id
          user_names << path.downcase
        else
          global_ids << path
        end
      end
      res = []
      res += find_all_by_global_id(global_ids).to_a
      res += where(:key => keys).to_a unless keys.blank?
      res += where(:user_name => user_names).to_a unless user_names.blank?
      res = res.uniq unless global_ids.any?{|id| id && id.match(/-/) } || sub_keys.length > 0
      if sub_keys.length > 0
        where(key: sub_keys).each do |record|
          (sub_key_users[record.key.downcase] || []).each do |u|
            rec = record.clone
            rec.instance_variable_set('@sub_id', u.global_id)
            rec.instance_variable_set('@sub_global', u)
            res << rec
          end
        end
      end
      res
    end
  end
  
  included do
    cattr_accessor :protected_global_id
    before_save :generate_nonce_if_protected
  end
end