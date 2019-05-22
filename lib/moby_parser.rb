module MobyParser
  # http://icon.shef.ac.uk/Moby/mpos.html
  # TODO: check out http://ucrel.lancs.ac.uk/claws7tags.html as well
  
  def self.all_words
    @@moby ||= nil
    convert! unless @@moby
    @@moby
  end
  
  def self.import_words
    self.all_words.each do |word, data|
      puts word
      word = WordData.find_or_initialize_by(:word => word, :locale => 'en')
      word.data ||= data
      word.save!
    end
  end
  
  def self.convert!(fn=nil)
    fn ||= "./lib/mobyposi.i"
    content = ""
    File.open(fn, 'rb') {|io| content += io.read }
    lines = content.split(/\r/)
    words = {}
    lines.each do |line|
      word, type_ids = line.split(215.chr)
      word = word.encode('UTF-8', :invalid => :replace, :undef => :replace).downcase
      # TODO: stemming for more matches, https://github.com/raypereda/stemmify
      types = []
      type_ids.each_char do |char|
        if QUESTIONS[word]
          types << 'question'
        end
        if EXPLETIVES[word]
          types << 'expletive'
        end
        if TYPE_CODES[char]
          types += TYPE_CODES[char]
        end
      end
      if words[word]
        types = words[word][:types] + types
      end
      words[word] = {
        word: word,
        types: types.uniq
      }.with_indifferent_access
    end
    @@moby = words
  end

  TYPE_CODES = {
    'N' => ['noun'],
    'p' => ['noun', 'plural noun'],
    'h' => ['noun', 'noun phrase'], 
    'V' => ['verb', 'usu participle verb'],
    't' => ['verb', 'transitive verb'],
    'i' => ['verb', 'intransitive verb'],
    'A' => ['adjective'],
    'v' => ['adverb'],
    'C' => ['conjunction'],
    'P' => ['preposition'],
    '!' => ['interjection'],
    'r' => ['pronoun'],
    'D' => ['article', 'definite article'],
    'I' => ['article', 'indefinite article'],
    'o' => ['nominative']
  }
  QUESTIONS = {
    'who' => true, 
    'what' => true, 
    'where' => true, 
    'why' => true, 
    'when' => true, 
    'how' => true, 
    'which' => true
  }
  EXPLETIVES = {
    'crap' => true, 
    'ass' => true
  }
end