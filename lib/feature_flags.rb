module FeatureFlags
  AVAILABLE_FRONTEND_FEATURES = ['subscriptions', 'assessments', 'custom_sidebar', 
              'canvas_render', 'snapshots', 'enable_all_buttons', 'chrome_filesystem',
              'video_recording', 'goals', 'app_connections', 'translation', 'geo_sidebar',
              'modeling', 'edit_before_copying']
  ENABLED_FRONTEND_FEATURES = ['subscriptions', 'assessments', 'custom_sidebar', 'snapshots',
              'video_recording', 'goals', 'modeling', 'geo_sidebar']
  DISABLED_CANARY_FEATURES = []
  def self.frontend_flags_for(user)
    flags = {}
    AVAILABLE_FRONTEND_FEATURES.each do |feature|
      if ENABLED_FRONTEND_FEATURES.include?(feature)
        flags[feature] = true
      elsif user && user.settings && user.settings['feature_flags'] && user.settings['feature_flags'][feature]
        flags[feature] = true
      elsif user && user.settings && user.settings['feature_flags'] && user.settings['feature_flags']['canary'] && !DISABLED_CANARY_FEATURES.include?(feature)
        flags[feature] = true
      end
    end
    flags
  end
  
  def self.feature_enabled_for?(feature, user)
    flags = frontend_flags_for(user)
    !!flags[feature]
  end
end