class MakeWordDataWordsUnique < ActiveRecord::Migration[5.0]
  def self.clear_some_dups
    dups = WordData.find_by_sql("select a.word, a.locale FROM word_data as a, word_data as b WHERE a.id != b.id and a.locale = b.locale AND a.word = b.word LIMIT 500").map{|w| [w.word, w.locale] }
    hash = {}
    dups.each do |word, locale|
      hash["#{word}:#{locale}"] = [word, locale]
    end
    hash.each do |key, arr|
      word, locale = arr
      words = WordData.where(word: word, locale: locale)
      first_id = words.order('id DESC')[0].id
      words.where(['id != ?', first_id]).destroy_all
      puts "#{word}:#{locale}"
    end
    hash.keys.length
  end

  def change
    while MakeWordDataWordsUnique.clear_some_dups > 0
      puts "..."
    end
    remove_index :word_data, ['word', 'locale']
    add_index :word_data, ['word', 'locale'], :unique => true
  end
end
