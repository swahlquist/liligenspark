class WordData < ActiveRecord::Base
  include SecureSerialize
  include Async
  secure_serialize :data
  replicated_model  
  before_save :generate_defaults
  
  def generate_defaults
    self.data ||= {}
  end
  
  def self.find_word(text, locale='en') 
    word = find_word_record(text, locale)
    word && word.data
  end
  
  def self.find_word_record(text, locale='en')
    return nil if text && text.match(/^[\+\:]/)
    word = self.find_by(:word => text.downcase, :locale => locale)
    word ||= self.find_by(:word => text.downcase.gsub(/[^A-Za-z0-9'\s]/, ''), :locale => locale)
    if !word && locale.match(/-/)
      locale = locale.split(/-/)[0]
      word ||= self.find_by(:word => text.downcase, :locale => locale)
      word ||= self.find_by(:word => text.downcase.gsub(/[^A-Za-z0-9'\s]/, ''), :locale => locale)
    end
    word
  end
  
  def self.translate(text, source_lang, dest_lang, type=nil)
    batch = translate_batch([{text: text, type: type}], source_lang, dest_lang)
    batch[:translations][text]
  end
  
  def self.translate_batch(batch, source_lang, dest_lang)
    res = {source: source_lang, dest: dest_lang, translations: {}}
    found = {}
    missing = batch
    batch.each do |obj|
      text = obj[:text]
      word = find_word_record(text, source_lang)
      new_text = nil
      if word && word.data
        word.data['translations'] ||= {}
        new_text ||= word.data['translations'][dest_lang]
        new_text ||= word.data['translations'][dest_lang.split(/-/)[0]]
      end
      if new_text
        res[:translations][text] = new_text
        missing = missing.select{|e| e[:text] != text }
      end
    end
    
    # API call to look up all missing strings
    query_translations(missing).each do |obj|
      res[:translations][obj[:text]] = obj[:translation]
      # schedule(:persist_translation, text, translation, source_lang, dest_lang, type)
    end
    
    return res
  end
  
  def self.query_translations(words)
    res = []
    missing.each do |obj|
      text = obj[:text]
      type = obj[:type]
      obj[:translation] = text.reverse 
      res << obj
    end
    res
  end
  
  def self.persist_translation(text, translation, source_lang, dest_lang, type)
    # record the translations on the source word
    word = find_word_record(text, source_lang)
    word ||= WordData.new(:word => text.downcase.strip, :locale => source_lang, :data => {:word => text.downcase.strip})
    if word && word.data
      word.data['translations'] ||= {}
      word.data['translations'][dest_lang] ||= translation
      word.data['translations'][dest_lang.split(/-/)[0]] ||= translation
      word.save
    end
    
    # record the reverse translation on the 
    backwards_word = find_word_record(translation, dest_lang)
    backwards_word ||= WordData.new(:word => translation.downcase.strip, :locale => dest_lang, :data => {:word => text.downcase.strip})
    if backwards_word && backwards_word.data
      backwards_word.data['translations'] ||= {}
      backwards_word.data['translations'][source_lang] ||= text
      backwards_word.data['translations'][source_lang.split(/-/)[0]] ||= text
      if type
        # TODO: right now this just assumes the first-translated is the most common usage for a homonym
        backwards_word.data['types'] ||= []
        backwards_word.data['types'] << type
        backwards_word.data['types'].uniq!
      end
      if word && word.data && word.data['types'] && word.data['types'][0]
        backwards_word.data['types'] ||= []
        backwards_word.data['types'] << word.data['types'][0]
        backwards_word.data['types'].uniq!
      end
      backwards_word.save
    end
  end
  
  def self.core_for?(word, user)
    self.core_list_for(user).map(&:downcase).include?(word.downcase.sub(/[^\w]+$/, ''))
  end
  
  def self.core_list_for(user)
    # TODO: users can choose a custom core word list if desired
    self.default_core_list
  end
  
  def self.reachable_core_list_for(user)
    list = self.core_list_for(user)
    board_ids = []
    if user.settings['preferences'] && user.settings['preferences']['home_board']
      board_ids << user.settings['preferences']['home_board']['id']
    end
    board_ids += user.sidebar_boards.map{|b| b['key'] }
    boards = Board.find_all_by_path(board_ids).uniq
    
    button_sets = boards.map{|b| b.board_downstream_button_set }.compact.uniq
    reachable_words = button_sets.map{|bs| 
      bs.data['buttons'].map{|b| 
        if b['hidden']
          nil
        elsif b['linked_board_id'] && !b['link_disabled']
          nil
        else
          b['label'] || b['vocalization']
        end
      }.compact
    }.flatten.map{|w| w.downcase.sub(/[^\w]+$/, '') }.uniq
    res = []
    list.each do |word|
      res << word if reachable_words.include?(word.downcase.sub(/[^\w]+$/, ''))
    end
    res
  end
  
  def self.default_core_list
    @@default_core_list ||= nil
    return @@default_core_list if @@default_core_list
    json = JSON.parse(File.read('./lib/core_lists.json')) rescue nil
    if json
      @@default_core_list = json[0]['words']
    end
    @@default_core_list ||= []
    @@default_core_list
  end
end
