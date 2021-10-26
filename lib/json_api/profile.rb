module JsonApi::Profile
  extend JsonApi::Json
  
  TYPE_KEY = 'profile'
  DEFAULT_PAGE = 25
  MAX_PAGE = 50
    
  def self.build_json(profile, args={})
    json = {}
    json['id'] = profile.global_id || profile.public_profile_id
    json['profile_id'] = profile.public_profile_id
    json['public'] = (profile.settings['public'] || false).to_s
    json['template'] = profile.settings['profile']
    json['template']['template_id'] = profile.global_id if profile.id
    json['template']['id'] ||= profile.public_profile_id if profile.public_profile_id
    if args[:permissions]
      json['permissions'] = profile.permissions_for(args[:permissions])
      if json['permissions']['edit']
      end
    end
    json
  end
end