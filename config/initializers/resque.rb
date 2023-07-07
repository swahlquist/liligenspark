module RedisInit
  cattr_accessor :cache_token
  
  def self.redis_uri
    redis_url = ENV["REDISCLOUD_URL"] || ENV["OPENREDIS_URL"] || ENV["REDISGREEN_URL"] || ENV["REDISTOGO_URL"] || ENV["REDIS_URL"]
    return nil unless redis_url
    URI.parse(redis_url)
  end
  
  def self.init
    uri = redis_uri
    return if !uri && ENV['SKIP_VALIDATIONS']
    raise "redis URI needed for resque" unless uri
    ns_suffix = ""
    if !Rails.env.production?
      ns_suffix = "-#{Rails.env}"
    end
    if defined?(Resque)
      Resque.redis = Redis.new(:host => uri.host, :port => uri.port, :password => uri.password)
      Resque.redis.namespace = "coughdrop#{ns_suffix}"
    end
    @redis_inst = Redis.new(:host => uri.host, :port => uri.port, :password => uri.password, :timeout => 5)
    @default = Redis::Namespace.new("coughdrop-stash#{ns_suffix}", :redis => @redis_inst)
    @permissions = Redis::Namespace.new("coughdrop-permissions#{ns_suffix}", :redis => @redis_inst)
    self.cache_token = 'abc'
  end

  def self.memory
    return nil unless @redis_inst
    @redis_inst.info(:memory)
  end

  def self.errors
    uri = RedisInit.redis_uri
    redis = Redis.new(:host => uri.host, :port => uri.port, :password => uri.password)
    key = 'coughdrop:failed'
    redis.type(key)
    len = redis.llen(key)
    puts JSON.pretty_generate(redis.lrange(key, 0, len))
  end

  def self.any_queue_pressure?
    (Resque.redis.llen('queue:slow') > (ENV['QUEUE_SLOW_BOG'] || 20000)) || (Resque.redis.llen('queue:default') > (ENV['QUEUE_DEFAULT_BOG'] || 10000))
  end

  def self.queue_pressure?
    ENV['STOP_CACHING'] || ENV['QUEUE_PRESSURE'] || (ENV['QUEUE_MAX'] && Resque.redis.llen('queue:slow') > ENV['QUEUE_MAX'].to_i)
  end

  def self.size_check(verbose=false)
    uri = redis_uri
    redis = Redis.new(:host => uri.host, :port => uri.port, :password => uri.password)
    total =  0
    prefixes = {}
    redis.keys.each do |key|
      type = redis.type(key)
      size = 0
      if type == 'list'
        len = redis.llen(key)
        size = redis.lrange(key, 0, len).to_json.length
      elsif type == 'string'
        size = redis.get(key).length
      elsif type == 'none'
      elsif type == 'set'
        size = redis.smembers(key).to_json.length
      elsif type == 'hash'
        size = redis.hgetall(key).to_json.length
      else
        raise "unknown type: #{type}"
      end
      total += size
      prefix = key.split(/\//)[0]
      prefixes[prefix] = (prefixes[prefix] || 0) + size
      if size > 500000
        puts "#{key}\t#{size}"
      elsif verbose
        puts key
      end
    end
    puts JSON.pretty_generate(prefixes)
    puts "total size\t#{total}"
  end
  
  def self.default
    @default
  end
  
  def self.permissions
    @permissions
  end
end

RedisInit.init

require 'permissable'
[ 'read_logs', 'full', 'modeling', 'read_boards', 'read_profile' ].each{|s| Permissable.add_scope(s) }
Permissable.set_redis(RedisInit.permissions, RedisInit.cache_token)
