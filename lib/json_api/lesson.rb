module JsonApi::Lesson
  extend JsonApi::Json
  
  TYPE_KEY = 'lesson'
  DEFAULT_PAGE = 10
  MAX_PAGE = 25
    
  def self.build_json(lesson, args={})
    json = {}
    
    json['id'] = lesson.global_id
    json['title'] = lesson.settings['title']
    json['url'] = lesson.settings['url']
    json['required'] = !!lesson.settings['required']
    json['lesson_code'] = lesson.nonce
    json['due_at'] = lesson.settings['due_at']
    json['due_ts'] = json['due_at'] ? Time.parse(json['due_at']).to_i : nil
    json['description'] = lesson.settings['description']
    json['time_estimate'] = lesson.settings['time_estimate']
    json['past_cutoff'] = lesson.settings['past_cutoff']
    json['badge'] = lesson.settings['badge']
    json['noframe'] = !!(lesson.settings['checked_url'] || {})['noframe']
    cutoff = lesson.settings['past_cutoff'] ? (Time.now.to_i - lesson.settings['past_cutoff']) : nil
    json['completed_users'] = {}

    (lesson.settings['completions'] || []).select{|c| !cutoff || c['ts'] > cutoff }.each do |comp|
      json['completed_users'][comp['user_id']] = {'rating' => comp['rating']}
    end
    if args[:obj]
      json['counts'] = lesson.user_counts(args[:obj])
      usage = lesson.settings['usages'].detect{|u| u['obj'] == Webhook.get_record_code(args[:obj])}
      if usage && args[:obj].is_a?(Organization)
        json['target_types'] = (args[:obj].settings['lessons'].detect{|l| l['id'] == lesson.global_id } || {})['types'] || ['supervisor']
      elsif usage && args[:obj].is_a?(OrganizationUnit)
        json['target_types'] = (args[:obj].settings['lesson'] || {})['types'] || ['supervisor']
      end
    end
    if args[:extra_user]
      json['id'] = "#{lesson.global_id}:#{lesson.nonce}:#{args[:extra_user].user_token}"
      json['user'] = JsonApi::User.as_json(args[:extra_user], limited_identity: true)
      comp = (lesson.settings['completions'] || []).detect{|c| c['user_id'] == args[:extra_user].global_id }
      json['user']['completion'] = comp if comp
    end

    json
  end
end

