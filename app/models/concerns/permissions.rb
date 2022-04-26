require 'permissable'

module Permissions
  extend ActiveSupport::Concern
  include Permissable::InstanceMethods

  def set_cached(prefix, data, expires=nil)
    return false if ENV['STOP_CACHING']
    expires ||= 1800 # 30 minutes
    begin
      Permissable.permissions_redis.setex(self.cache_key(prefix), expires, data.to_json)
    rescue Redis::CommandError => e
      if e.to_s.match(/OOM/)
        # don't break on out-of-memory errors
      else
        raise e
      end
    end
  end

  def self.setex(redis, key, timeout, value, requied=false)
    return false if ENV['STOP_CACHING']
    begin
      redis.setex(key, timeout, value)
    rescue Redis::CommandError => e
      raise e unless e.to_s.match(/OOM/) && !required
    end
  end
  
  module ClassMethods
    include Permissable::ClassMethods
  end
end