class Lesson < ApplicationRecord
  include GlobalId
  include SecureSerialize
  include Processable
  include Permissions
  include Async

  secure_serialize :settings
  before_save :generate_defaults
  after_save :check_url

  add_permissions('view', ['*']) { !!self.public }
  add_permissions('view', 'edit') {|user| self.user_id == user.id }
  add_permissions('view') {|user| (self.settings['usages'] || []).map{|u| u['obj'] }.include?(Webhook.get_record_code(user)) }
  add_permissions('view', 'edit') {|user| 
    # First usage gets edit permission
    if self.organization_id
      org = Organization.find(self.organization_id)
      org && org.allows?(user, 'edit')
    elsif rec.organization_unit_id
      unit = OrganizationUnit.find(self.organization_unit_id)
      unit && unit.allows?(user, 'edit')
    elsif rec.user_id
      user = User.find(self.user_id)
      user && user.allows?(user, 'supervise')
    else
      false
    end
  }
  add_permissions('view') {|user| 
    # All usages get view permission
    (self.settings['usages'] || []).each do |use|
      record_code = use['obj']
      rec = Webhook.find_record(record_code) if record_code
      if rec.is_a?(User)
        return true if rec.allows?(user, 'supervise')
      elsif rec.is_a?(Organization)
        return true if rec.allows?(user, 'edit')
      elsif rec.is_a?(OrganizationUnit)
        return true if rec.allows?(user, 'edit')
      end
    end
    return false
  }
  cache_permissions

  def generate_defaults
    self.settings ||= {}
    self.settings['title'] ||= "Unnamed Lesson"
    # self.settings['past_cutoff'] ||= 1.year.to_i
    tally = 0
    cnt = 0
    (self.settings['completions'] || []).each do |comp|
      if comp['rating']
        cnt += 1
        tally += comp['rating']
      end
    end
    self.settings['average_rating'] = cnt == 0 ? nil : (tally.to_f / cnt.to_f).round(1)
    self.settings['completed_user_ids'] = (self.settings['completions'] || []).map{|c| c['user_id']}.compact.uniq

    self.public ||= false
    self.popularity = 0
    self.popularity += (self.settings['usages'] || []).length
    true
  end

  def nonce
    self.settings ||= {}
    if !self.settings['nonce']
      self.settings['nonce'] = GoSecure.nonce('lesson_nonce')
      self.save
    end
    self.settings['nonce']
  end

  def load_users_and_extras(obj)
    users = []
    if obj.instance_variable_get('@users_and_extras')
      return obj.instance_variable_get('@users_and_extras')
    end
    if obj.is_a?(Organization)
      users = obj.attached_users('all')
    elsif obj.is_a?(OrganizationUnit)
      users = User.find_all_by_global_id(obj.all_user_ids)
    elsif obj.is_a?(User)
      users = [obj]
    end
    extras = UserExtra.where(user: users)
    obj.instance_variable_set('@users_and_extras', [users, extras])
    [users, extras]
  end

  def user_counts(obj)
    users, extras = load_users_and_extras(obj)
    lookups = {}
    completes = 0
    users.each{|u| lookups[u.global_id] = true }
    (self.settings['completions'] || []).each do |comp|
      completes += 1 if lookups[comp['user_id']]
    end
    {total: users.length, complete: completes}
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
      extra.settings['completed_lessons'] << {'lesson_id' => lesson.global_id, 'url' => lesson.settings['url'], 'ts' => Time.now.to_i, 'rating' => rating}
    end
    extra.save
  end

  def self.unassign(lesson, obj)
    return false unless lesson && obj
    lesson.settings['usages'] ||= []
    lesson.settings['usages'] = lesson.settings['usages'].select{|u| u['obj'] != Webhook.get_record_code(obj) }
    lesson.save
    if obj.is_a?(User)
      extra = UserExtra.find_or_create_by(user: obj)
      extra.settings['lessons'] ||= []
      extra.settings['lessons'] = extra.settings['lessons'].select{|l| l['id'] != lesson.global_id }
      extra.save
    elsif obj.is_a?(Organization)
      obj.settings['lessons'] ||= []
      obj.settings['lessons'] = obj.settings['lessons'].select{|l| l['id'] != lesson.global_id }
      obj.save
    elsif obj.is_a?(OrganizationUnit)
      # Rooms can only have one lesson running at a time
      obj.settings['lesson'] = nil if obj.settings['lesson'] && obj.settings['lesson']['id'] == lesson.global_id
      obj.save
    else
      return false
    end
    return true
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
        'assigned' => Time.now.to_i,
        'types' => types || ['supervisor']
      }
      obj.save
    else
      return false
    end
    return true
  end

  def history_check(obj)
    users, extras = load_users_and_extras(obj)
    self.settings['completions'] ||= []
    changed = false
    users.each do |user|
      if !self.settings['completions'].detect{|c| c['user_id'] == user.global_id }
        ue = extras.detect{|e| e.user_id == user.id}
        if ue && ue.settings
          (ue.settings['completed_lessons'] || []).each do |less|
            if less['id'] == self.global_id || less['url'] == self.settings['url']
              if !self.settings['past_cutoff'] || less['ts'] > (Time.now.to_i - self.settings['past_cutoff'])
                self.settings['completions'] << {
                  'user_id' => user.global_id,
                  'ts' => less['ts'],
                  'prior' => true,
                  'rating' => less['rating']
                }
                changed = true
              end
            end
          end
        end
      end
    end
    self.save if changed
    true
  end

  def self.decorate_completion(user, lessons_json)
    if user
      ue = UserExtra.find_by(user: user)
      completed_hash = {}
      rating_hash = {}
      if ue && ue.settings
        (ue.settings['completed_lessons'] || []).each do |comp|
          if comp['lesson_id'] && comp['ts']
            completed_hash[comp['lesson_id']] = [completed_hash[comp['lesson_id']] || 0, comp['ts']].max
            completed_hash[comp['url']] = [completed_hash[comp['url']] || 0, comp['ts']].max
            if comp['rating'] && comp['rating'] > 0
              rating_hash[comp['lesson_id']] = [rating_hash[comp['lesson_id']] || 0, comp['rating']].max
              rating_hash[comp['url']] = [rating_hash[comp['url']] || 0, comp['rating']].max
            end
          end
        end
      end
      lessons_json.each do |lesson|
        if completed_hash[lesson['id']]
          lesson['completed_ts'] = completed_hash[lesson['id']]
        end
        if rating_hash[lesson['id']]
          lesson['rating'] = rating_hash[lesson['id']]
        end
        if lesson['past_cutoff']
          cutoff = Time.now.to_i - lesson['past_cutoff']
          comp = [completed_hash[lesson['id']], completed_hash[lesson['url']]].compact.max
          lesson['completed'] = true if comp && comp > cutoff
        else
          lesson['completed'] = true if completed_hash[lesson['id']] || completed_hash[lesson['url']]
        end
      end
    end
    lessons_json
  end

  def process_params(params, non_user_params)
    self.settings ||= {}
    if non_user_params['target']
      if non_user_params['target'].is_a?(Organization)
        self.organization_id = non_user_params['target'].id
      elsif non_user_params['target'].is_a?(OrganizationUnit)
        self.organization_unit_id = non_user_params['target'].id
      elsif non_user_params['target'].is_a?(User)
        self.user_id = non_user_params['target'].id
      end        
    end
    self.settings['author_id'] = non_user_params['author'].global_id
    self.settings['title'] = process_string(params['title']) if params['title']
    self.settings['description'] = process_string(params['description']) if params['description']
    self.settings['url'] = process_string(params['url']) if params['url']
    self.settings['required'] = process_boolean(params['required']) if params['required']
    self.settings['due_at'] = Time.parse(params['due_at']).iso8601 if params['due_at']
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
