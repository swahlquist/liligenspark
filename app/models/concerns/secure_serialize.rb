module SecureSerialize
  extend ActiveSupport::Concern
  
  include GoSecure::SerializeInstanceMethods

  def paper_trail_for_secure_column?
    @for_secure ||= !!(self.class.respond_to?(:paper_trail_options) && self.class.paper_trail_options && 
          (!self.class.paper_trail_options[:only] || self.class.paper_trail_options[:only].include?(self.class.secure_column.to_s)))
  end
  
  def rollback_to(date)
    version = self.versions.reverse_each.detect{|v| v.created_at < date }
    #version = prior_version.next || prior_version
    raise "can't rollback a shallow clone" if @sub_id
    raise "no old version found for self.class.to_s:#{self.global_id}" if !version
    record = self.class.load_version(version) rescue nil
    raise "version couldn't be loaded" if !record

    record.instance_variable_set('@buttons_changed', 'rollback') if record.is_a?(Board)
    if record.is_a?(User)
      record.instance_variable_set('@do_track_boards', true) 
      record.settings['home_board_changed'] = true
      record.settings['sidebar_changed'] = true
    end
    record.save
    version.created_at
  end

  def mark_as_ss_saving
    @ss_saving = true
    true
  end

  def mark_as_ss_destroying
    @ss_destroying = true
    true
  end

  def done_ss_destroying
    @ss_destroying = false
    true
  end

  def done_ss_saving
    @ss_saving = false
    true
  end

  def attribute_before_last_save(attr)
    if (attr == 'settings' || attr == :settings) && @ss_saving
      load_secure_object unless @loaded_secure_object 
      @secure_object
    else
      super
    end
  end

  def attribute_in_database(attr)
    if (attr == 'settings' || attr == :settings) && @ss_destroying
      load_secure_object unless @loaded_secure_object 
      @secure_object
    else
      super
    end
  end

  module ClassMethods
    include GoSecure::SerializeClassMethods

    def user_versions(global_id)
      # TODO: sharding
      local_id = self.local_ids([global_id])[0]
      current = self.find_by_global_id(global_id)
      versions = []
      all_versions = PaperTrail::Version.where(:item_type => self.to_s, :item_id => local_id).order('id DESC')

      all_versions.each_with_index do |v, idx|
        next if versions.length >= 30
        if v.whodunnit && !v.whodunnit.match(/^job/)
          later_version = all_versions[idx - 1]
          later_object = current
          if later_version
            later_object = self.load_version(later_version) rescue nil
            if later_object && !later_object.settings
              later_object.load_secure_object rescue nil
            end
          end
          if later_object
            v.instance_variable_set('@later_object', later_object)
          end
          versions << v
        end
      end
      versions
    end

    def load_version(v)
      model = v.item
      attrs = v.object_deserialized
      return nil unless attrs
      if !model
        model = self.find_by(:id => v.item_id)
        model ||= self.new
        if model
          (model.attribute_names - attrs.keys).each { |k| attrs[k] = nil }
        end
      end
      attrs.each do |key, val|
        model.send("#{key}=", val)
      end
      model
    end
  end

  included do
    before_save :mark_as_ss_saving rescue nil
    before_destroy :mark_as_ss_destroying rescue nil
    after_save :done_ss_saving rescue nil
    after_destroy :done_ss_destroying rescue nil
  end
end