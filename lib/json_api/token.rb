module JsonApi::Token
  def self.as_json(user, device, args={})
    json = {}
    
    access, refresh = device.tokens
    json['access_token'] = access
    json['refresh_token'] = refresh if args[:include_refresh]
    json['token_type'] = 'bearer'
    # TODO: there are times where we shouldn't include user_name and user_id, yes?
    json['user_name'] = user.user_name
    json['user_id'] = user.global_id
    # the anonymized user id should be consistent for the external tool
    dev_key = device.developer_key_id == 0 ? device.id : device.developer_key_id
    json['anonymized_user_id'] = user.anonymized_identifier("external_for_#{dev_key}")

    if device.settings['temporary_device']
      json['temporary_device'] = true
    end
    json['long_token'] = device.settings['long_token']
    json['long_token_set'] = !!device.settings['long_token_set']
    if device.created_at < Date.parse(FeatureFlags::FEATURE_DATES['token_refresh'])
      json['long_token_set'] = true
    end
    json['scopes'] = device.permission_scopes
    
    json
  end
end
