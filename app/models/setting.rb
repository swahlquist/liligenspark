class Setting < ActiveRecord::Base
  include SecureSerialize
  secure_serialize :data

  replicated_model  

  def self.set(key, value)
    setting = self.find_or_initialize_by(:key => key)
    setting.value = value
    setting.save
    value
  end
  
  def self.get(key)
    setting = self.find_by(:key => key)
    setting && (setting.data || setting.value)
  end
  
  def self.blocked_email?(email)
    email = email.downcase
    hash = self.get('blocked_emails') || {}
    hash[email] == true
  end
  
  def self.blocked_emails
    hash = self.get('blocked_emails') || {}
    hash.map{|k, v| k }.sort
  end
  
  def self.block_email!(email)
    email = email.downcase
    setting = self.find_or_create_by(:key => 'blocked_emails')
    setting.data ||= {}
    setting.data[email] = true
    setting.save!
  end
end
