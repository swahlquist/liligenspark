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
    json['description'] = lesson.settings['description']
    json['time_estimate'] = lesson.settings['time_estimate']
    json['past_cutoff'] = lesson.settings['past_cutoff']
    json['badge'] = lesson.settings['badge']
    json['noframe'] = !(self.settings['checked_url'] || {})['noframe']

    json
  end
end

