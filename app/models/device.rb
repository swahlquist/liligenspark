class Device < ActiveRecord::Base
  include GlobalId
  include SecureSerialize
  secure_serialize :settings
  belongs_to :user
  belongs_to :developer_key
  belongs_to :user_integration
  before_save :generate_defaults
  after_save :update_user_device_name
  after_destroy :invalidate_cached_keys

  VALID_API_SCOPES = {
    'read_profile' => "access basic profile information",
    'basic_supervision' => "supervise communicators"
  }

  def generate_defaults
    self.settings ||= {}
    self.settings['name'] ||= 'Web browser for Desktop' if self.default_device?
    self.settings['name'] ||= self.device_key.split(/\s/, 2)[1] if self.system_generated?
    true
  end

  def token_timeout
    long_token = self.settings['long_token'] == nil ? true : self.settings['long_token']
    # force a logout for tokens that have been used for an extended period of time
    if self.token_type == :integration || self.token_type == :app || self.token_type == :unknown
      if long_token
        5.years.to_i
      else
        28.days.to_i
      end
    else
      # browser tokens can last 3 months max before needing a re-login
      if long_token
        6.months.to_i
      else
        28.days.to_i
      end
    end
  end

  def token_type
    if self.user_integration_id
      :integration
    elsif !self.developer_key_id || self.developer_key_id == 0
      if self.settings && self.settings['browser']
        :browser
      elsif self.settings && self.settings['app']
        :app
      else
        :unknown
      end
    else
      :integration
    end
  end
  
  def system_generated?
    self.developer_key_id == 0
  end
  
  def default_device?
    self.device_key == 'default' && self.system_generated?
  end
  
  def hidden?
    !!self.settings['hidden']
  end
  
  def disabled?
    !!(self.settings && self.settings['disabled'])
  end
  
  def anonymized_identifier
    self.settings ||= {}
    if !self.settings['anonymized_identifier']
      self.settings['anonymized_identifier'] = GoSecure.nonce('device_pseudonymization')
      self.save
    end
    GoSecure.lite_hmac("#{self.global_id}:#{self.created_at.iso8601}", self.settings['anonymized_identifier'], 1)
  end

  def permission_scopes
    if disabled?
      []
    elsif self.user_integration_id
      (self.settings && self.settings['permission_scopes']) || []
    elsif self.developer_key_id && self.developer_key_id != 0
      (self.settings && self.settings['permission_scopes']) || []
    else
      ['full']
    end
  end
  
  def last_used_at
    uses = (self.settings['keys'] || []).map{|k| k['last_timestamp'] }.sort
    time = uses.length > 0 && Time.at(uses.last) rescue nil
    time ||= self.created_at
  end
  
  def update_user_device_name
    # if the device_name changed the it'll need to be updated on the user record
  end

  def new_access_token
    key = "#{self.global_id}~#{Digest::SHA512.hexdigest(Time.now.to_i.to_s + rand(99999).to_s + self.global_id)}"  
  end
  
  def generate_token!(long_token=nil)
    raise "device must already be saved" unless self.id
    clean_old_keys
    if self.token_type == :app
      # app installations can only have one access token at a time, there will be
      # no risk of concurrency from different sources
      # also, app tokens need long_token to be manually set
      self.settings['keys'] = []
    elsif self.token_type == :integration
      # integrations always use long tokens
      long_token = true
    elsif self.token_type == :browser
      # browser sessions set long_token at authentication, everyone else sets it after
      long_token = !!long_token
      self.settings['long_token_set'] = true
    end
    self.settings['long_token'] = long_token if long_token != nil
    key = new_access_token
    
    # Keep track of which devices were used most recently/frequently to help
    # display most-relevant ones in the UI under "user devices".
    self.settings['token_history'] ||= []
    self.settings['token_history'] << Time.now.to_i
    self.settings['keys'] << {
      'value' => key,
      'timestamp' => Time.now.to_i,
      'last_timestamp' => Time.now.to_i,
      'refresh' => GoSecure.nonce('device_refresh_token')
    }
    self.save
  end
  
  def logout!
    self.settings['keys'] = []
    self.save
  end
  
  def unique_device_key
    raise "must be saved first" unless self.global_id
    return device_key if self.system_generated?
    raise "missing developer_key_id" unless self.developer_key_id
    "#{self.device_key}_#{self.developer_key_id}"
  end
  
  def inactivity_timeout
    if self.token_type == :integration
      # integration tokens must be refreshed every 24 hours
      24.hours.to_i
    elsif self.settings && self.settings['long_token']
      if self.token_type == :app
        # app tokens can go a long time between uses if on a trusted device
        14.months.to_i
      elsif self.token_type == :browser
        # browser tokens can go for a little while between uses if on a trusted device
        28.days.to_i
      else
        14.days.to_i
      end
    else
      # if not on a trusted device, inactivity timeout is very short
      12.hours.to_i
    end
  end

  def invalidate_cached_keys
    self.settings ||= {}
    (self.settings['keys'] || []).each do |key|
      token = key['value']
      RedisInit.permissions.del("user_token/#{token}")
    end
    true
  end
  
  def invalidate_keys!
    self.invalidate_cached_keys
    self.settings['keys'] = []
    self.save
  end
  
  def clean_old_keys
    self.settings ||= {}
    self.settings['app'] = true if self.token_type == :unknown && self.settings['name'] && self.settings['name'].match(/App/)
    # apps should set the long token setting not long after being created
    self.settings['long_token'] = (self.created_at < FeatureFlags::FEATURE_DATES['token_refresh'] ? true : false) if self.token_type == :app && self.settings['long_token'] == nil && self.created_at < 12.hours.ago
    keys = self.settings['keys'] || []
    @expired_keys ||= {}
    @refreshable_keys ||= {}
    new_keys = []
    keys.each do |k|
      # tokens that haven't been inactive for too long, 
      # AND tokens that were created too long ago (or were
      # scheduled for expiry due to refresh request)
      inactive_too_long = self.token_type != :integration && k['last_timestamp'] <= Time.now.to_i - (k['timeout'] || self.inactivity_timeout)
      needs_refresh = self.token_type == :integration && (Time.now.to_i - (k['timestamp'] || k['last_timestamp']) > (k['timeout'] || self.inactivity_timeout))
      created_too_long_ago = (Time.now.to_i - (k['timestamp'] || k['last_timestamp']) > self.token_timeout) || (k['expire_at'] && k['expire_at'] < Time.now.to_i)
      if created_too_long_ago
        # force token removal after a certain duration
        @expired_keys[k['value']] = true
        RedisInit.permissions.del("user_token/#{k['value']}")
      elsif !inactive_too_long && !needs_refresh
        new_keys << k
      elsif k['refresh']
        # mark unused tokens as needing a refresh
        @refreshable_keys[k['value']] = true
        RedisInit.permissions.del("user_token/#{k['value']}") unless k['needs_refresh']
        k['needs_refresh'] = true
        new_keys << k
      else
        @expired_keys[k['value']] = true
        RedisInit.permissions.del("user_token/#{k['value']}")
      end
    end
    self.settings['keys'] = new_keys
  end

  def self.check_token(token, app_version)
    # Skip device lookup if you already have the necessary information cached
    user = nil, device_id = nil, scopes = nil
    cached = RedisInit.permissions.get("user_token/#{token}")
    res = {}
    if cached
      user_id, device_id, scopes_string = cached.split(/::/)
      scopes = (scopes_string || "").split(',')
      res[:cached] = true
    else
      id = token.split(/~/)[0]
      device = Device.find_by_global_id(id)
      user_id = device && device.related_global_id(device.user_id)
      device_id = device && device.global_id
      if !device || !device.valid_token?(token, app_version)
        expired = device && (device.instance_variable_get('@expired_keys') || {})[token]
        needs_refresh = device && (device.instance_variable_get('@refreshable_keys') || {})[token]
        res[:error] = "Invalid token"
        res[:error] = "Expired token" if expired
        res[:error] = "Token needs refresh" if needs_refresh
        if !expired && !needs_refresh
          device_id = nil
          user_id = nil
        end
        res[:error] = "Disabled token" if device && device.disabled?
        res[:skip_on_token_check] = true
        res[:can_refresh] = true if needs_refresh && device && !device.disabled?
        res[:invalid_token] = true
      end
      scopes = device && device.permission_scopes
    end
    if user_id
      users_lookup = User
      if defined?(Octopus)
        conn = (Octopus.config[Rails.env] || {}).keys.sample
        users_lookup = users_lookup.using(conn) if conn
      end
      user = users_lookup.find_by_global_id(user_id)
      if defined?(Octopus)
        user ||= User.using(:master).find_by_global_id(user_id)
      end
      if user && device_id
        user.permission_scopes = scopes

        store = [user_id, device_id, scopes.join(',')].join("::")
        RedisInit.permissions.setex("user_token/#{token}", 12.hours.from_now.to_i, store) if !res[:error]
        res[:user] = user
        res[:device_id] = device_id
      elsif user_id
        res[:error] = "Missing user"
      end
    end
    res
  end
  
  def valid_token?(token, app_version=nil)
    clean_old_keys
    return false if self.disabled?
    keys = (self.settings && self.settings['keys']) || []
    key = keys.detect{|k| k['value'] == token }
    do_save = false
    if key && key['last_timestamp'] < 30.minutes.ago.to_i && !key['needs_refresh']
      self.settings['keys'].each_with_index do |key, idx|
        if key['value'] == token
          key['last_timestamp'] = Time.now.to_i
          self.settings['keys'][idx] = key
          do_save = true
        end
      end
      User.where(['id = ? and updated_at < ?', self.user_id, 24.hours.ago]).update_all(updated_at: Time.now)
    end
    if app_version && self.settings['app_version'] != app_version
      self.settings['app_version'] = app_version
      self.settings['app_versions'] ||= []
      self.settings['app_versions'] << [app_version, Time.now.to_i]
      self.settings['app_versions'] = self.settings['app_versions'].uniq(&:first)
      do_save = true
    end
    self.save if do_save
    !!(key && !key['needs_refresh'])
  end
  
  def tokens
    clean_old_keys
    if self.settings['keys'].empty? && self.id
      self.generate_token!
    end
    [(self.settings['keys'][-1] || {})['value'], (self.settings['keys'][-1] || {})['refresh']]
  end

  def generate_from_refresh_token!(access_token, refresh_token)
    return [nil, nil] unless self.token_type == :integration
    # keep the old key around, but mark it as about to expire,
    # generate a new key with the old refresh_token and expiration
    clean_old_keys
    new_key = nil
    new_refresh = nil
    do_save = false
    self.settings['keys'].each_with_index do |key, idx|
      if access_token && key['value'] == access_token && refresh_token && key['refresh'] == refresh_token
        # give a concurrency window before expiring the access/refresh pair
        self.settings['keys'][idx]['expire_at'] = 5.minutes.from_now.to_i
        self.generate_token!
        self.settings['keys'][-1]['refresh'] = refresh_token
        self.settings['keys'][-1]['timestamp'] = key['timestamp']
        do_save = true
        new_key, new_refresh = self.tokens
      end
    end
    self.save if do_save
    [new_key, new_refresh]
  end
end
