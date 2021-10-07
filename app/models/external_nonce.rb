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
    nonce.increment('uses') if nonce
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


  #      Base64.decode64(iv_b64)
  # //   cipher = OpenSSL::Cipher.new('aes-256-gcm')
  # //   cipher.encrypt
  # //   cipher.iv = iv
  # //   cipher.key = key
  # //   cipher.auth_data = "bacon"
  # //   cipherText = cipher.update(plainText) + cipher.final
  # //   Base64.encode64(cipherText + cipher.auth_tag)

  # bytes = [79, 37, 167, 229, 66, 89, 205, 112, 38, 62, 177, 80, 182, 240, 203, 19, 90, 104, 143, 41, 92, 41, 161, 149].pack('c*')
  # iv = "npF3oAyHglcNvATX"
  # msg = "fb4kLUOW5yiZ9FsDgbujqe6tj+vGfn2HPgy4BYK+QDEiNnFRi95A6HKNhlxc/RhbufCDfstG5GkduwDF7cnWa4kfZRHtLvgs1GthGfP/6Yo8YwGjoBaItvoo+Nk+j5WNm7F4bXP+jrBNA1qSvcPjvzMQgZdlOGBeyFjVZ0ipqgePe4AkRgb3Lu3UO9VtGZMthcnEZXzehIaN0QXkBanLUKKllQkszjmTlz2iAHu2nzwdZ4A4ogk/M3DpQG1FHP4kcz5AMd4+6sVsUBneqrtssH+65e3a7Q10IOyyDE36oxY2p4pGtaKxOj1ht8MpavFJkvdrQoQ+x1y7pdcaw5xtHZ56sa+kofSC95XIS9+YeQ=="
  # bytes = Base64.decode64(msg)
  # cipherText = bytes[0,bytes.length - 16]
  # tag = bytes[-16, 16]
  # cipher = OpenSSL::Cipher.new('aes-256-gcm')
  # cipher.decrypt
  # cipher.iv = Base64.decode64(iv)
  # cipher.key = '12345678901234567890123456789012'
  # cipher.auth_data = "12345678901234567890123456789012"
  # cipher.auth_tag = tag
  # plainText = cipher.update(cipherText) + cipher.final
  # JSON.parse(plainText)
end
