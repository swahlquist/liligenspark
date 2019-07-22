class PurchaseToken < ApplicationRecord
  belongs_to :user
  def self.map(token, user)
    record = self.find_or_create_by(token: token)
    record.user = user
    record.save
  end

  def self.retrieve(token)
    record = self.find_by(token: token)
    record && record.user
  end
end
