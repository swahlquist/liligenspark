module JsonApi::Word
  extend JsonApi::Json
  
  TYPE_KEY = 'word'
  DEFAULT_PAGE = 10
  MAX_PAGE = 25
    
  def self.build_json(obj, args={})
    json = {}
    
    json['id'] = obj.global_id
    json['word'] = obj.word
    json['locale'] = obj.locale
    json['parts_of_speech'] = obj.data['types']
    json['antonyms'] = obj.data['antonyms']
    json['primary_part_of_speech'] = (obj.data['types'] || [])[0]
    json['inflection_overrides'] = obj.data['inflection_overrides'] || {}

    json
  end
end
