class PurchaseToken < ApplicationRecord
  belongs_to :user
  def self.map(token, device_id, user)
    record = self.find_or_create_by(token: token)
    record.hashed_device_id = GoSecure.sha512(device_id, 'purchase device uuid') if !device_id.blank?
    record.user = user
    record.save
  end

  def self.retrieve(token)
    record = self.find_by(token: token)
    record && record.user
  end

  def self.for_device(device_id=nil)
    self.find_by(hashed_device_id: GoSecure.sha512(device_id, 'purchase device uuid'))
  end
end
