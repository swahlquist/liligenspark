module Worker
  @queue = :default
  extend BoyBand::WorkerMethods

  def self.method_stats(queue='default')
    list = Worker.scheduled_actions(queue); list.length
    methods = {}
    list.each do |job|
      code = (job['args'][0] || 'Unknown') + "." + (job['args'][2]['method'] || 'unknown')
      methods[code] = (methods[code] || 0) + 1
    end; list.length
    puts JSON.pretty_generate(methods.to_a.sort_by(&:last))
    methods
  end

  def self.find_record(klass, id)
    obj = klass.find_by(id: id)
    obj.using(:master).reload if obj
    obj
  end

  def self.domain_id
    JsonApi::Json.current_host || 'default'
  end

  def note_job(hash)
    # no-op
  end

  def clear_job(hash)
    # no-op
  end

  def self.check_for_big_entries
    lists = [[RedisInit.default, "RedisInit.default"], [RedisInit.permissions, "RedisInit.permissions"], [Resque.redis, "Resque.redis"]]
    bigs = []
    lists.each do |queue, name|
      name ||= queue.inspect
      puts name
      queue.keys.each do |key|
        type = queue.type(key)
        str = ""
        if type == 'set'
          str = queue.smembers(key).to_json
        elsif type == 'list'
          str = queue.lrange(key, 0, -1).to_json
        elsif type == 'hash'
          str = queue.hgetall(key).to_json
        elsif type == 'string'
          str = queue.get(key)
        elsif type == 'none'
        else
          puts "  UNKNOWN TYPE #{type}"
        end
        if str.length > 1000
          puts "  #{str.length} #{key} #{name}\n"
          bigs << "#{key}-#{name}"
        end
      end
    end
    bigs
  end

  def self.set_domain_id(val)
    @@domain_id = val
    JsonApi::Json.set_host(val)
    JsonApi::Json.load_domain(val)
  end

  def self.requeue_failed(method)
    count = Resque::Failure.count
    count.times do |i|
      Resque::Failure.requeue(i)
    end
    count.times do |i|
      Resque::Failure.remove(0)
    end
  end
end

