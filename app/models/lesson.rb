class Lesson < ApplicationRecord
  include GlobalId
  include SecureSerialize
  include Permissions
  include Async

  secure_serialize :settings
  before_save :generate_defaults
  after_save :check_url

  add_permissions('view', ['*']) { !!self.public }
  add_permissions('view', 'edit') {|user| self.user_id == user.id }
  add_permissions('view') {|user| (self.settings['usages'] || []).include?(Webhook.get_record_code(user)) }
  cache_permissions

  def generate_defaults
    self.settings ||= {}
    self.settings['title'] ||= "Unnamed Lesson"
    self.settings['past_cutoff'] ||= 1.year.to_i
    self.public ||= false
    self.popularity = 0
    self.popularity += (lesson.settings['usages'] || []).length
    true
  end

  def check_url(frd=false)
    return if !self.settings['url'] || (self.settings['checked_url'] && self.settings['checked_url']['url'] = self.settings['url'])
    if !frd
      self.schedule(:check_url, true)
      return
    end
    res = Typhoeus.head(self.settings['url'], followlocation: true)
    self.settings['checked_url'] = {'url' => self.settings['url']}
    if res.code < 300 && res.code > 199
      if ['deny', 'sameorigin'].include?((res.headers['X-Frame-Options'] || '').downcase)
        self.settings['checked_url']['noframe'] = true
      end
      if res.headers['Content-Security-Policy']
        parts = res.headers['Content-Security-Policy'].split(/\s*;\s*/)
        parts.each do |part|
          head, str = part.split(/:\s*/, 2)
          if head.downcase == 'frame-ancestors'
            srcs = str.split(/\s+/)
            self.settings['checked_url']['noframe'] = true
          end
        end
      end
    end
    self.save
  end

  def self.complete(lesson, user, rating, feedback=nil)
    # Rating can be [declined, liked, disliked, loved]
    return false unless lesson && user
    lesson.settings['completions'] ||= []
    comp = lesson.settings['completions'].detect{|c| c['user_id'] == user.global_id }
    if comp
      comp['ts'] = Time.now.to_i
      comp['rating'] = rating
    else
      lesson.settings['completions'] << {'user_id' => user.global_id, 'ts' => Time.now.to_i, 'rating' => rating}      
    end
    if feedback && !feedback.blank?
      lesson.settings['feedback'] ||= []
      lesson.settings['feedback'] << {'user_id' => user.global_id, 'text' => feedback, 'ts' => Time.now.to_i}
    end
    lesson.save
    extra = UserExtra.find_or_create_by(user: user)
    extra.settings['completed_lessons'] ||= []
    comp = extra.settings['completed_lessons'].detect{|c| c['id'] == lesson.global_id }
    if comp
      comp['ts'] = Time.now.to_i
      comp['rating'] = rating
    else
      extra.settings['completed_lessons'] << {'lesson_id' => lesson.global_id, 'ts' => Time.now.to_i, 'rating' => rating}
    end
    extra.save
  end

  def self.assign(lesson, obj, types=nil, assignee=nil)
    return false unless lesson && obj
    lesson.settings['usages'] ||= []
    lesson.settings['usages'] << {'ts' => Time.now.to_i, 'obj' => Webhook.get_record_code(obj)}
    lesson.save
    if assignee
      ae = UserExtra.find_or_create_by(user: assignee)
      ae.settings['assignee_lessons'] ||= []
      ae.settings['assignee_lessons'] << {'id' => lesson.global_id, 'assigned' => Time.now.to_i}
      ae.settings['assignee_lessons'] = ae.settings['assignee_lessons'][0, 10]
      ae.settings['assignee_lessons'] = ae.settings['assignee_lessons'].select{|l| l['assigned'] > 14.months.ago.to_i }
      ae.save
    end
    if obj.is_a?(User)
      extra = UserExtra.find_or_create_by(user: obj)
      extra.settings['lessons'] ||= []
      extra.settings['lessons'] << {
        'id' => lesson.global_id,
        'assigned' => Time.now.to_i
      }
      extra.save
    elsif obj.is_a?(Organization)
      obj.settings['lessons'] ||= []
      obj.settings['lessons'] << {
        'id' => lesson.global_id,
        'assigned' => Time.now.to_i,
        'types' => types || ['supervisor']
      }
      obj.save
    elsif obj.is_a?(OrganizationUnit)
      # Rooms can only have one lesson running at a time
      obj.settings['lesson'] = {
        'id' => lesson.global_id,
        'assigned' => Time.now.to_i
      }
    else
      return false
    end
    return true
  end

  def process_params(params, non_user_params)
    self.settings['title'] = process_string(params['title']) if params['title']
    self.settings['description'] = process_string(params['description']) if params['title']
    self.settings['url'] = process_url(params['url']) if params['url']
    self.settings['time_estimate'] = params['time_estimate'].to_i
    self.settings['time_estimate'] = nil if self.settings['time_estimate'] == 0
    self.settings['past_cutoff'] = params['past_cutoff'].to_i
    self.settings['past_cutoff'] = nil if self.settings['past_cutoff'] == 0
    self.settings['state'] = process_string(params['state'])
    if params['badge']
      self.settings['badge'] = params['badge']
    end
    true
  end
  
end
