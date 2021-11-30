class ExternalNonce < ApplicationRecord
  include GlobalId

  before_save :generate_defaults
  
  def generate_defaults
    self.purpose ||= 'unknown'
    self.transform ||= 'sha512'
    self.nonce ||= GoSecure.nonce("nonce_for_#{self.purpose}")
    self.uses ||= 0
    true
  end

  def encryption_key
    raise "missing environment variable: SECURE_NONCE_KEY" unless ENV['SECURE_NONCE_KEY']
    sha = GoSecure.sha512(self.nonce, ENV['SECURE_NONCE_KEY'])
    # return [ aes-gcm-key, aed-gcm-auth-data ]
    [sha[0, 32], sha[32..-1]]
  end

  def self.track_usage!(nonce_id)
    nonce = ExternalNonce.find_by_global_id(nonce_id)
    if nonce
      nonce.increment('uses') 
      nonce.save
    end
    !!nonce
  end

  def encryption_result
    parts = self.encryption_key
    {id: self.global_id, key: parts[0], extra: parts[1]}
  end

  def self.for_user(user)
    nonce = nil
    # Generate a new nonce once the current one has been used
    # NOTE: If multiple profiles happen while offline, it is possible
    # that the nonce will be used more than once before being updated
    if user.settings['external_nonce'] && user.settings['external_nonce']['expires'] > Time.now.to_i
      nonce = ExternalNonce.find_by_global_id(user.settings['external_nonce']['id'])
      nonce.uses ||= 0
      nonce = nil if nonce.uses > 0
    end
    if !nonce
      ExternalNonce.where(['created_at < ? AND uses = ?', 24.months.ago, 0]).delete_all
      nonce = ExternalNonce.generate('user_enc')
      user.settings['external_nonce'] = {
        'id' => nonce.global_id,
        'expires' => 1.year.from_now.to_i
      }
      user.save
    end
    nonce.encryption_result
  end

  def self.generate(purpose)
    res = self.create(purpose: purpose)
    res
  end

  def self.init_client_encryption
    {
      'iv' => Base64.encode64(OpenSSL::Cipher.new('aes-256-gcm').random_iv).strip,
      'key' => GoSecure.sha512(GoSecure.nonce('extra_data_key'), 'extra_data_key')[0, 32],
      'hash' => GoSecure.nonce('extra_data_auth_data')[0, 16]
    }
  end

  def self.client_encrypt(obj, opts)
    cipher = OpenSSL::Cipher.new('aes-256-gcm')
    cipher.encrypt
    cipher.iv = Base64.decode64(opts['iv'])
    cipher.key = opts['key']
    cipher.auth_data = opts['hash']
    cipherText = cipher.update(obj.to_json) + cipher.final
    "aes256-" + Base64.encode64(cipherText + cipher.auth_tag)
  end

  def self.client_decrypt(enc, opts)
    raise "nope" unless enc.match(/^aes256-/)
    bytes = Base64.decode64(enc[7..-1])
    cipherText = bytes[0,bytes.length - 16]
    tag = bytes[-16, 16]
    cipher = OpenSSL::Cipher.new('aes-256-gcm')
    cipher.decrypt
    cipher.iv = Base64.decode64(opts['iv'])
    cipher.key = opts['key']
    cipher.auth_data = opts['hash']
    cipher.auth_tag = tag
    plainText = cipher.update(cipherText) + cipher.final
    JSON.parse(plainText)
  end
end
