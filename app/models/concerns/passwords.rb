module Passwords
  extend ActiveSupport::Concern
  
  def generate_password_reset
    clean_password_resets
    if self.settings['password_resets'].length > 5
      Rails.logger.warn("Throttled password reset for user \"#{self.user_name}\", too many attempts")
      return false 
    end
    self.settings['password_resets'] << {
      'timestamp' => Time.now.to_i,
      'code' => GoSecure.nonce('password_reset_code')
    }
    self.save
  end
  
  def password_reset_code
    clean_password_resets
    reset = self.settings['password_resets'][-1]
    reset && reset['code']
  end
  
  def reset_token_for_code(code)
    clean_password_resets
    reset = self.settings['password_resets'].detect{|r| r['code'] == code }
    return nil unless reset
    
    reset['token'] = GoSecure.nonce('password_reset_token')
    self.save
    reset['token']
  end
  
  def valid_reset_token?(token)
    clean_password_resets
    !!self.settings['password_resets'].detect{|r| r['token'] == token }
  end
  
  def used_reset_token!(token)
    clean_password_resets
    self.settings['password_resets'] = self.settings['password_resets'].select{|r| r['token'] != token }
    self.save
  end
  
  def clean_password_resets
    self.settings ||= {}
    now = Time.now.to_i
    self.settings['password_resets'] ||= []
    self.settings['password_resets'].select!{|r| r['timestamp'] > now - (60 * 60 * 3) }
  end

  def valid_password?(guess)
    self.settings ||= {}
    if self.settings['password'] && self.settings['password']['pre_hash_algorithm'] && !guess.match(/^hashed\?:#/)
      guess = pre_hash(guess)
    end
    res = GoSecure.matches_password?(guess, self.settings['password'])
    if res && self.schedule_deletion_at
      # prevent auto-deletion whenever a user logs in
      self.schedule_deletion_at = nil
      self.save
    end
    if res && !guess.match(/^hashed\?:#/)
      hashed = pre_hash(guess)
      self.generate_password(hashed)
      self.save
    elsif res && GoSecure.outdated_password?(self.settings['password'])
      self.generate_password(guess)
      self.save
    end
    res
  end

  def pre_hash(str)
    ['hashed', 'sha512', Digest::SHA512.hexdigest(str)].join("?:#")
  end
  
  def generate_password(password)
    password = pre_hash(password) if !password.match(/^hashed\?:#/)
    self.settings ||= {}
    self.settings['password'] = GoSecure.generate_password(password)
    self.settings['password']['pre_hash_algorithm'] = 'sha512'
  end
end