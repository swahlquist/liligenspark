require 'spec_helper'

describe LibraryCache, :type => :model do
  describe "invalidate_all" do
    it "should invalidate all caches" do
      cache = LibraryCache.create
      expect(cache.invalidated_at).to eq(nil)
      LibraryCache.invalidate_all
      expect(cache.reload.invalidated_at).to_not eq(nil)
    end

    it "should write over fresh cache records that are invalidated" do
      cache = LibraryCache.create
      cache.data['fallbacks']['bacon'] = {'image_id' => 'aaa', 'added' => 6.hours.ago.to_i, 'url' => 'http://www.example.com/bacon.png'}
      cache.invalidated_at = Time.now
      expect(cache.add_word('bacon', {'url' => 'http://www.example.com/bacon.png'})).to_not eq('aaa')
      expect(cache.data['fallbacks']['bacon']['url']).to eq('http://www.example.com/bacon.png')
      expect(cache.data['fallbacks']['bacon']['data']).to_not eq(nil)
    end

    it "should use invalidated caches" do
      cache = LibraryCache.create
      cache.data['defaults']['bacon'] = {'url' => 'http://www.example.com/bacon.png', 'image_id' => 'aaa', 'added' => 12.months.ago.to_i, 'data' => {'a' => 1}}
      cache.data['fallbacks']['bacon'] = {'url' => 'http://www.example.com/bacon2.png', 'image_id' => 'bbb', 'added' => 12.days.ago.to_i, 'data' => {'b' => 1}}
      cache.invalidated_at = Time.now
      res = cache.find_words(['bacon'], nil)
      expect(res).to_not eq(nil)
      expect(res['bacon']).to_not eq(nil)
      expect(res['bacon']['b']).to eq(1)
      expect(res['bacon']['coughdrop_image_id']).to eq('bbb')
    end
  end

  describe "add_word" do
    it "should require a valid word and hash" do
      cache = LibraryCache.create
      expect(cache.add_word(nil, nil)).to eq(nil)
      expect(cache.add_word('bacon', nil)).to eq(nil)
      expect(cache.add_word(nil, {'url' => 'http://www.example.com/bacon.png'})).to eq(nil)
    end

    it "should not add words with spaces" do
      cache = LibraryCache.create
      expect(cache.add_word('bacon', {'url' => 'http://www.example.com/bacon.png'})).to_not eq(nil)
      expect(cache.add_word('bacon master', {'url' => 'http://www.example.com/bacon.png'})).to eq(nil)
    end

    it "should not overwrite recently-written words" do
      cache = LibraryCache.create
      cache.data['fallbacks']['bacon'] = {'image_id' => 'aaa', 'added' => Time.now.to_i, 'url' => 'http://www.example.com/bacon.png'}
      expect(cache.add_word('bacon', {'url' => 'http://www.example.com/bacon.png'})).to eq('aaa')
      expect(cache.data['fallbacks']['bacon']['url']).to eq('http://www.example.com/bacon.png')
      expect(cache.data['fallbacks']['bacon']['data']).to eq(nil)
    end

    it "should overwrite outdated words" do
      cache = LibraryCache.create
      cache.data['fallbacks']['bacon'] = {'image_id' => 'aaa', 'added' => 12.months.ago.to_i, 'url' => 'http://www.example.com/bacon.png'}
      expect(cache.add_word('bacon', {'url' => 'http://www.example.com/bacon.png'})).to_not eq('aaa')
      expect(cache.data['fallbacks']['bacon']['url']).to eq('http://www.example.com/bacon.png')
      expect(cache.data['fallbacks']['bacon']['data']).to_not eq(nil)
    end

    it "should overwrite recent-but-invalidated words" do
      cache = LibraryCache.create
      cache.data['fallbacks']['bacon'] = {'image_id' => 'aaa', 'added' => 6.hours.ago.to_i, 'url' => 'http://www.example.com/bacon.png'}
      cache.invalidated_at = Time.now
      expect(cache.add_word('bacon', {'url' => 'http://www.example.com/bacon.png'})).to_not eq('aaa')
      expect(cache.data['fallbacks']['bacon']['url']).to eq('http://www.example.com/bacon.png')
      expect(cache.data['fallbacks']['bacon']['data']).to_not eq(nil)
    end

    it "should add words with spaces if they are default words" do
      cache = LibraryCache.create
      res = cache.add_word('bacon master', {'default' => true, 'url' => 'http://www.example.com/bacon.png'})
      expect(res).to_not eq(nil)
      expect(cache.data['defaults']['bacon master']).to_not eq(nil)
      expect(cache.data['defaults']['bacon master']['url']).to eq('http://www.example.com/bacon.png')
    end

    it "should prune outdated results when adding" do
      cache = LibraryCache.create
      cache.data['defaults']['chocolate'] = {'added' => 0, 'data' => {'a' => 1}}
      res = cache.add_word('bacon', {'default' => true, 'url' => 'http://www.example.com/bacon.png'})
      expect(res).to_not eq(nil)
      expect(cache.data['defaults']['bacon']).to_not eq(nil)
      expect(cache.data['defaults']['bacon']['url']).to eq('http://www.example.com/bacon.png')
      expect(cache.data['defaults']['bacon']['data']).to_not eq(nil)
      expect(cache.data['defaults']['chocolate']).to_not eq(nil)
      expect(cache.data['defaults']['chocolate']['data']).to eq(nil)
    end

    it "should create a button_image record if not already available" do
      cache = LibraryCache.create
      image_id = cache.add_word('bacon', {'url' => 'http://www.example.com/bacon.png'})
      expect(image_id).to_not eq(nil)
      bi = ButtonImage.find_by_global_id(image_id)
      expect(bi.url).to eq('http://www.example.com/bacon.png')
      expect(cache.data['fallbacks']['bacon']['url']).to eq('http://www.example.com/bacon.png')
      expect(cache.data['fallbacks']['bacon']['data']).to_not eq(nil)
    end

    it "should use an existing button_image record referenced in the cache for the same url if available" do
      cache = LibraryCache.create
      image_id = cache.add_word('bacon', {'url' => 'http://www.example.com/bacon.png'})
      expect(image_id).to_not eq(nil)
      bi = ButtonImage.find_by_global_id(image_id)
      expect(bi.url).to eq('http://www.example.com/bacon.png')
      expect(cache.data['fallbacks']['bacon']['url']).to eq('http://www.example.com/bacon.png')
      expect(cache.data['fallbacks']['bacon']['data']).to_not eq(nil)
      image_id = cache.add_word('bacons', {'url' => 'http://www.example.com/bacon.png'})
      expect(image_id).to eq(bi.global_id)
    end

    it "should use a button_image that matches without a user if none found in the cache" do
      cache = LibraryCache.create
      bi = ButtonImage.create(url: 'http://www.example.com/bacon.png')
      image_id = cache.add_word('bacons', {'url' => 'http://www.example.com/bacon.png'})
      expect(image_id).to eq(bi.global_id)
    end

    it "should return an image_id" do
      cache = LibraryCache.create
      image_id = cache.add_word('bacon', {'url' => 'http://www.example.com/bacon.png'})
      expect(image_id).to_not eq(nil)
    end

    it "should use the cached image_id on old results only if still a valid record" do
      cache = LibraryCache.create
      cache.data['fallbacks']['bacon'] = {'image_id' => 'aaa', 'added' => 4.months.ago.to_i, 'url' => 'http://www.example.com/bacon.png'}
      expect(cache.add_word('bacon', {'url' => 'http://www.example.com/bacon.png'})).to_not eq('aaa')
      expect(cache.add_word('bacon', {'url' => 'http://www.example.com/bacon.png'})).to_not eq(nil)
    end
  end
  describe "find_words" do
    it "should prefer default words over fallback words" do
      cache = LibraryCache.create
      cache.data['defaults']['bacon'] = {'url' => 'http://www.example.com/bacon.png', 'image_id' => 'aaa', 'added' => 12.days.ago.to_i, 'data' => {'a' => 1}}
      cache.data['fallbacks']['bacon'] = {'url' => 'http://www.example.com/bacon2.png', 'image_id' => 'bbb', 'added' => 12.days.ago.to_i, 'data' => {'b' => 1}}
      res = cache.find_words(['bacon'], nil)
      expect(res).to_not eq(nil)
      expect(res['bacon']).to_not eq(nil)
      expect(res['bacon']['a']).to eq(1)
      expect(res['bacon']['coughdrop_image_id']).to eq('aaa')
    end
    
    it "should not use expired results" do
      cache = LibraryCache.create
      cache.data['defaults']['bacon'] = {'url' => 'http://www.example.com/bacon.png', 'image_id' => 'aaa', 'added' => 12.months.ago.to_i, 'data' => {'a' => 1}}
      cache.data['fallbacks']['bacon'] = {'url' => 'http://www.example.com/bacon2.png', 'image_id' => 'bbb', 'added' => 12.days.ago.to_i, 'data' => {'b' => 1}}
      res = cache.find_words(['bacon'], nil)
      expect(res).to_not eq(nil)
      expect(res['bacon']).to_not eq(nil)
      expect(res['bacon']['b']).to eq(1)
      expect(res['bacon']['coughdrop_image_id']).to eq('bbb')
    end

    it "should use invalidated results" do
      cache = LibraryCache.create
      cache.data['defaults']['bacon'] = {'url' => 'http://www.example.com/bacon.png', 'image_id' => 'aaa', 'added' => 12.months.ago.to_i, 'data' => {'a' => 1}}
      cache.data['fallbacks']['bacon'] = {'url' => 'http://www.example.com/bacon2.png', 'image_id' => 'bbb', 'added' => 12.days.ago.to_i, 'data' => {'b' => 1}}
      cache.invalidated_at = Time.now
      res = cache.find_words(['bacon'], nil)
      expect(res).to_not eq(nil)
      expect(res['bacon']).to_not eq(nil)
      expect(res['bacon']['b']).to eq(1)
      expect(res['bacon']['coughdrop_image_id']).to eq('bbb')
    end

    it "should not allow unauthorized access to premium symbols" do
      cache = LibraryCache.create(library: 'pcs')
      cache.data['defaults']['bacon'] = {'url' => 'http://www.example.com/bacon.png', 'image_id' => 'aaa', 'added' => 12.months.ago.to_i, 'data' => {'a' => 1}}
      cache.data['fallbacks']['bacon'] = {'url' => 'http://www.example.com/bacon2.png', 'image_id' => 'bbb', 'added' => 12.days.ago.to_i, 'data' => {'b' => 1}}
      cache.invalidated_at = Time.now
      res = cache.find_words(['bacon'], nil)
      expect(res).to_not eq(nil)
      expect(res['bacon']).to eq(nil)

      u = User.create
      u.subscription_override('enable_extras')
      res = cache.find_words(['bacon'], u.reload)
      expect(res).to_not eq(nil)
      expect(res['bacon']).to_not eq(nil)
    end

    it "should return coughdrop_image_id in the results" do
      cache = LibraryCache.create
      cache.data['defaults']['bacon'] = {'url' => 'http://www.example.com/bacon.png', 'image_id' => 'aaa', 'added' => 12.months.ago.to_i, 'data' => {'a' => 1}}
      cache.data['fallbacks']['bacon'] = {'url' => 'http://www.example.com/bacon2.png', 'image_id' => 'bbb', 'added' => 12.days.ago.to_i, 'data' => {'b' => 1}}
      res = cache.find_words(['bacon'], nil)
      expect(res).to_not eq(nil)
      expect(res['bacon']).to_not eq(nil)
      expect(res['bacon']['b']).to eq(1)
      expect(res['bacon']['coughdrop_image_id']).to eq('bbb')
    end
  end

  describe "save_if_added" do
    it "should not save if no words have been added" do
      cache = LibraryCache.create
      expect(cache).to_not receive(:save)
      cache.save_if_added
    end

    it "should only save if words have been added" do
      cache = LibraryCache.create
      expect(cache).to receive(:save)
      cache.instance_variable_set('@words_changed', true)
      cache.save_if_added
      expect(cache.instance_variable_get('@words_changed')).to eq(false)
    end
  end
end
