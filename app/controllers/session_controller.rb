class SessionController < ApplicationController
  before_action :require_api_token, :only => [:oauth_logout]
  
  def oauth
    error = nil
    response.headers.except! 'X-Frame-Options'
    key = DeveloperKey.find_by(:key => params['client_id'])
    if !key
      error = 'invalid_key'
    end
    if key && !key.valid_uri?(params['redirect_uri'])
      error = 'bad_redirect_uri'
    end
    @app_name = (key && key.name) || "the application"
    @app_icon = (key && key.icon_url) || "https://opensymbols.s3.amazonaws.com/libraries/arasaac/friends_3.png"
    if error
      @error = error
      render #:status => 400
    else
      scope = params['scope'] || 'read_profile'
      scope = scope.sub(/full/, '')
      config = {
        'scope' => scope,
        'redirect_uri' => params['redirect_uri'] || key.redirect_uri,
        'device_key' => params['device_key'],
        'device_name' => params['device_name'],
        'app_name' => @app_name,
        'app_icon' => @app_icon
      }
      @scope_descriptors = scope.split(/:/).uniq.map{|s| Device::VALID_API_SCOPES[s] }.compact.join("\n")
      @scope_descriptors = "no permissions requested" if @scope_descriptors.blank?
      
      @code = GoSecure.nonce('oauth_code')
      RedisInit.default.setex("oauth_#{@code}", 1.hour.to_i, config.to_json)
      # render login page
      render
    end
  end
  
  def oauth_login
    error = nil
    user = nil
    response.headers.except! 'X-Frame-Options'
    config = JSON.parse(RedisInit.default.get("oauth_#{params['code']}")) rescue nil
    if !config
      error = 'code_not_found'
    else
      paramified_redirect = config['redirect_uri'] + (config['redirect_uri'].match(/\?/) ? '&' : '?')
      if params['reject']
        if config['redirect_uri'] == DeveloperKey.oob_uri
          redirect_to oauth_local_url(:error => 'access_denied')
        else
          redirect_to paramified_redirect + "error=access_denied"
        end
        return
      end
      user = User.find_for_login(params['username'], (@domain_overrides || {})['org_id'], params['password'])
      if user && params['approve_token']
        id = params['approve_token'].split(/~/)[0]
        device = Device.find_by_global_id(id)
        if !device || !device.valid_token?(params['approve_token']) || !device.permission_scopes.include?('full')
          error = 'invalid_token'
        end
      elsif !user || !user.valid_password?(params['password'])
        error = 'invalid_login'
      end
    end
    if error
      @app_name = (config && config['app_name']) || 'the application'
      @app_icon = (config && config['app_icon']) || "https://opensymbols.s3.amazonaws.com/libraries/arasaac/friends_3.png"
      @code = params['code']
      @error = error
      render :oauth, :status => 400
    else
      config['user_id'] = user.id.to_s
      RedisInit.default.setex("oauth_#{params['code']}", 1.hour.to_i, config.to_json)
      if config['redirect_uri'] == DeveloperKey.oob_uri
        redirect_to oauth_local_url(:code => params['code'])
      else
        redirect_to paramified_redirect + "code=#{params['code']}"
      end
    end
  end
  
  
  def oauth_token
    key = DeveloperKey.find_by(:key => params['client_id'])
    error = nil
    if !key
      error = 'invalid_key'
    elsif key.secret != params['client_secret']
      error = 'invalid_secret'
    end
    
    config = JSON.parse(RedisInit.default.get("oauth_#{params['code']}")) rescue nil
    if !error
      if !config
        error = 'code_not_found'
      elsif !config['user_id']
        error = 'token_not_ready'
      end
    end
    
    if error
      api_error 400, {error: error}
    else
      RedisInit.default.del("oauth_#{params['code']}")
      device = Device.find_or_create_by(:user_id => config['user_id'], :developer_key_id => key.id, :device_key => config['device_key'])
      device.settings['name'] = config['device_name']
      device.settings['name'] += device.id.to_s if device.settings['name'] == 'browser'
      device.settings['name'] ||= (key.name || "Token") + " account"
      device.settings['permission_scopes'] = []
      (config['scope'] || '').split(/:/).uniq.each do |scope|
        device.settings['permission_scopes'].push(scope) if Device::VALID_API_SCOPES[scope]
      end
      device.generate_token!
      render json: JsonApi::Token.as_json(device.user, device, :include_refresh => true).to_json
    end
  end
  
  def oauth_logout
    Device.find_by_global_id(@api_device_id).logout!
    render json: {logout: true}.to_json
  end
  
  def oauth_local
    response.headers.except! 'X-Frame-Options'
  end

  def oauth_token_refresh
    device = Device.find_by_global_id(@api_device_id)

    key = DeveloperKey.find_by(:key => params['client_id'])
    error = nil
    if !key
      error = 'invalid_key'
    elsif key.secret != params['client_secret']
      error = 'invalid_secret'
    elsif !device || device.developer_key_id != key.id
      error = 'invalid_token'
    end

    if error
      api_error 400, {error: error}
    elsif @api_user && device && device.token_type == :integration
      token, refresh_token = device.generate_from_refresh_token!(params['access_token'], params['refresh_token'])
      if token
        render json: JsonApi::Token.as_json(@api_user, device, :include_refresh => true).to_json
      else
        api_error 400, { error: "Invalid refresh token" }
      end
    else
      api_error 400, { error: "Could not find refresh token"}
    end
  end

  def auth_admin
    success = false
    if @api_user && @api_user.admin?
      admin_token = GoSecure.nonce('admin_token')
      cookies[:admin_token] = admin_token
      Permissable.permissions_redis.setex('/admin/auth/' + admin_token, 2.hours.to_i, @api_user.global_id)
      success = true
    end
    render json: {success: success}
  end


  def token
    set_browser_token_header
    if params['grant_type'] == 'password'
      pending_u = User.find_for_login(params['username'], (@domain_overrides || {})['org_id'], params['password'])
      u = nil
      if params['client_id'] == 'browser' && GoSecure.valid_browser_token?(params['client_secret'])
        u = pending_u
      else
        return api_error 400, { error: "Invalid client_secret for client_id", client_id: params['client_id'] }
      end
      if u && u.valid_password?(params['password'])
        # generated based on request headers
        # TODO: should also have some kind of developer key for tracking
        device_key = request.headers['X-Device-Id'] || params['device_id'] || 'default'
        
        if request.headers['X-INSTALLED-COUGHDROP'] == 'true'
          app_devices = Device.where(user_id: u.id, developer_key_id: 0).select{|d| d.token_type == :app && !d.settings['temporary_device'] }
          if app_devices.length > 0 && u.eval_account?
            # Eval accounts are only allowed to log in on one device at a time.
            # If they log into a new device. prompt them to see if they want to
            # auto-log-out on the other device, or cancel this login.
            temporary_device = true
          end
        end
        d = Device.find_or_create_by(:user_id => u.id, :developer_key_id => 0, :device_key => device_key)

        store_user_data = (u.settings['preferences'] || {})['cookies'] != false
        d.settings['ip_address'] = store_user_data ? request.remote_ip : nil
        d.settings['user_agent'] = store_user_data ? request.headers['User-Agent'] : nil
        d.settings['mobile'] = params['mobile'] == 'true'
        d.settings['browser'] = true if request.headers['X-INSTALLED-COUGHDROP'] == 'false'
        d.settings['temporary_device'] = true if temporary_device
        d.settings.delete('temporary_device') unless u.eval_account?
        d.settings['app'] = true if request.headers['X-INSTALLED-COUGHDROP'] == 'true'
        d.generate_token!(!!(params['long_token'] && params['long_token'] != 'false'))
        # find or create a device based on the request information
        # some devices (i.e. generic browser) are allowed multiple
        # tokens, so the token 
        render json: JsonApi::Token.as_json(u, d).to_json
      else
        old_key = OldKey.find_by(:type => 'user', :key => params['username'])
        user = old_key && old_key.record
        if user && user.valid_password?(params['password'])
          api_error 400, { error: "User name was changed", user_name: user.user_name}
        else
          api_error 400, { error: "Invalid authentication attempt" }
        end
      end
    else
      api_error 400, { error: "Invalid authentication approach" }
    end
  end
  
  def token_check
    set_browser_token_header
    if @api_user
      device = Device.find_by_global_id(@api_device_id)
      valid = device && device.valid_token?(params['access_token'], request.headers['X-CoughDrop-Version'])
      expired = device && (device.instance_variable_get('@expired_keys') || {})[params['access_token']]
      needs_refresh = device && (device.instance_variable_get('@refreshable_keys') || {})[params['access_token']]
      json = {
        authenticated: valid, 
        expired: !!(expired || needs_refresh),
        user_name: @api_user.user_name, 
        user_id: @api_user.global_id,
        device_id: @api_device_id,
        avatar_image_url: (valid ? @api_user.generated_avatar_url : nil),
        scopes: device && device.permission_scopes,
        sale: ENV['CURRENT_SALE'],
        global_integrations: UserIntegration.global_integrations.keys
      }
      json[:can_refresh] = true if needs_refresh && !expired
      render json: json.to_json
    else
      render json: {
        authenticated: false, 
        sale: ENV['CURRENT_SALE'],
        global_integrations: UserIntegration.global_integrations.keys
      }.to_json
    end
  end
end
