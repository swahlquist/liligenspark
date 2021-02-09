class LibraryCache < ApplicationRecord
  include GlobalId
  include SecureSerialize

  secure_serialize :data
  before_save :generate_defaults

  def generate_defaults
    self.data ||= {}
    self.data['defaults'] ||= {}
    self.data['fallbacks'] ||= {}
    @words_changed = false
    true
  end

  def self.invalidate_all
    LibraryCache.update_all(invalidated_at: Time.now)
  end

  def add_word(word, hash, default=false)
    return nil unless word && hash
    word = word.downcase
    word_data = hash.slice('url', 'thumbnail_url', 'content_type', 'name', 'width', 'height', 'external_id', 'public', 'protected', 'protected_source', 'license')
    # Normalize the stored data
    if !word_data['url'] && hash['image_url']
      word_data['url'] = hash['image_url']
      word_data['thumbnail_url'] = hash['image_url']
      word_data['external_id'] = hash['id']
      word_data['license'] = {
        'type' => hash['licence'],
        'copyright_notice_url' => hash['license_url'],
        'source_url' => hash['source_url'],
        'author_name' => hash['author'],
        'author_url' => hash['author_url'],
        'uneditable' => true
      }
    end
    return nil unless word_data['url']
    return nil if word.match(/\s/) && !hash['default'] # (prevent too much stuffing)
    category = hash['default'] ? 'defaults' : 'fallbacks'
    cutoff = hash['default'] ? 2.months.ago.to_i :  4.weeks.ago.to_i
    cutoff = [cutoff, self.invalidated_at.to_i].max
    # Don't update if it's the same result as stored recently
    if self.data[category][word] && self.data[category][word]['added'] > cutoff && self.data[category][word]['image_id'] && self.data[category][word]['url'] == word_data['url']
      return self.data[category][word]['image_id']  
    end
    # Try to find any cached record with the same url
    # Also prune old results at the same time
    image_id = nil
    ['defaults', 'fallbacks'].each do |cat|
      self.data[cat].each do |k, h|
        if h['added'] < 3.months.ago.to_i
          self.data[cat][k].delete('data')
        end
        image_id ||= h['image_id'] if h['image_id'] && h['url'] == word_data['url']
      end
    end
    image_id = nil if !ButtonImage.select('id, nonce').find_by_global_id(image_id)
    if !image_id
      # Create a new image record if none exists already
      # NOTE: As long as we cache the same URL that came originally from
      # LessonPix then the cached_copy_url code should get applied
      # once that background job finishes
      bi = ButtonImage.find_by(url: word_data['url'], user_id: nil)
      bi ||= ButtonImage.process_new(word_data.merge({'search_term' => word}), {no_author: true})
      # if bi && bi.settings['cached_copy_url']
      #   word_data['url'] = bi.settings['cached_copy_url']
      # end
      image_id = bi.global_id
    end
    self.data[category][word] = {
      'data' => word_data,
      'image_id' => image_id,
      'word' => word,
      'url' => word_data['url'],
      'added' => Time.now.to_i
    }
    @words_changed = true
    return image_id

    # hash['url']
    # hash['thumbnail_url']
    # hash['content_type']
    # hash['name'] # optional
    # hash['width']
    # hash['height']
    # hash['external_id'] # optional
    # hash['public']
    # hash['protected'] # optional
    # hash['protected_source'] #optional string
    # hash['license']['type']
    # hash['license']['copyright_notice_url']
    # hash['license']['source_url']
    # hash['license']['author_name']
    # hash['license']['author_url']
    # hash['license']['uneditable']
  end 

  def find_words(words, user)
    found = {}
    no_extras = !user || !user.subscription_hash['extras_enabled']
    lessonpix = user && Uploader.lessonpix_credentials(user)
    if self.library == 'pcs' && no_extras
      return found
    elsif self.library == 'symbolstix' && no_extras
      return found
    elsif self.library == 'lessonpix' && no_extras && !lessonpix
      return found
    end

    words.each do |word|
      word = word.downcase
      ['defaults', 'fallbacks'].each do |cat|
        cutoff = (cat == 'defaults') ? 3.months.ago.to_i : 8.weeks.ago.to_i
        if !found[word] && self.data[cat][word] && self.data[cat][word]['added'] > cutoff && self.data[cat][word]['data']
          found[word] = {}.merge(self.data[cat][word]['data'])
          found[word]['coughdrop_image_id'] = self.data[cat][word]['image_id']
        end
      end
    end
    found
  end

  def save_if_added
    self.save if @words_changed
    @words_changed = false
  end
end
