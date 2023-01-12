class ActivationCode < ApplicationRecord
  def self.lookup(code)
    self.find_by(code_hash: code_hash(code))
  end

  def self.code_hash(code)
    GoSecure.sha512(code, 'activation_code_hash')[0, 24]
  end

  def find_record
    Webhook.find_record(self.record_code)
  end
  
  def self.find_record(code)
    obj = lookup(code)
    obj && obj.find_record
  end

  def self.generate(code, record)
    return false if self.lookup(code)
    ac = ActivationCode.create(code_hash: code_hash(code), record_code: Webhook.get_record_code(record)) rescue nil
    return ac && ac.id
  end
end
