require 'spec_helper'

describe FeatureFlags do
  describe "frontend_flags_for" do
    it "should gracefully handle no user" do
      stub_const('FeatureFlags::AVAILABLE_FRONTEND_FEATURES', [])
      flags = FeatureFlags.frontend_flags_for(nil)
      expect(flags).to eq({})
    end
    
    it "should return the default set of flags" do
      stub_const('FeatureFlags::AVAILABLE_FRONTEND_FEATURES', ['a', 'b', 'c'])
      stub_const('FeatureFlags::ENABLED_FRONTEND_FEATURES', ['d', 'b', 'c'])
      flags = FeatureFlags.frontend_flags_for(nil)
      expect(flags).to eq({'b' => true, 'c' => true})
    end
    
    it "should consider user-specific flags" do
      stub_const('FeatureFlags::AVAILABLE_FRONTEND_FEATURES', ['a', 'b', 'c'])
      stub_const('FeatureFlags::ENABLED_FRONTEND_FEATURES', ['b'])
      u = User.new(:settings => {})
      u.settings['feature_flags'] = {'c' => true, 'd' => true}
      flags = FeatureFlags.frontend_flags_for(u)
      expect(flags).to eq({'b' => true, 'c' => true})
    end
    
    it "should enable everything (except canary exceptions) for canary users" do
      stub_const('FeatureFlags::AVAILABLE_FRONTEND_FEATURES', ['a', 'b', 'c'])
      stub_const('FeatureFlags::ENABLED_FRONTEND_FEATURES', ['b'])
      stub_const('FeatureFlags::DISABLED_CANARY_FEATURES', ['a'])
      u = User.new(:settings => {})
      u.enable_feature('canary')
      flags = FeatureFlags.frontend_flags_for(u)
      expect(flags).to eq({'b' => true, 'c' => true})
    end
  end
  
  describe "user_created_after?" do
    it "should return the correct response" do
      u = User.new
      expect(FeatureFlags.user_created_after?(u, 'word_suggestion_images')).to eq(true)
      u.created_at = Date.parse("Jan 1, 2000")
      expect(FeatureFlags.user_created_after?(u, 'word_suggestion_images')).to eq(false)
      u.created_at = Date.parse("Jan 1, 2020")
      expect(FeatureFlags.user_created_after?(u, 'word_suggestion_images')).to eq(true)
      u.created_at = Date.parse("Jan 1, 2020")
      expect(FeatureFlags.user_created_after?(u, 'bacon')).to eq(false)
      u.created_at = 2.days.ago
      expect(FeatureFlags.user_created_after?(u, 'bacon')).to eq(false)
      u.created_at = nil
      expect(FeatureFlags.user_created_after?(u, 'bacon')).to eq(false)
    end
  end
end
