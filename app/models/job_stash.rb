class JobStash < ApplicationRecord
  include GlobalId
  include SecureSerialize

  secure_serialize :data

  def self.flush_old_records
    JobStash.where(['created_at < ?', 4.weeks.ago]).delete_all
  end

  def self.events_for(log)
    res = []
    JobStash.where(user_id: log.user_id, log_session_id: log.id).each do |stash|
      (stash.data['events'] || []).each do |event|
        res << event
      end
    end
    res
  end

  def self.add_events_to(log, events)
    raise "Log need id and user id before stashing events" unless log && log.id && log.user_id
    JobStash.create(user_id: log.user_id, log_session_id: log.id, data: {
      'events' => events
    })
  end

  def self.remove_events_from(log, events)
    to_remove = {}
    events.each{|e| to_remove["#{e['id']}::#{e['timestamp']}"] = true }
    JobStash.where(user_id: log.user_id, log_session_id: log.id).each do |stash|
      stash.with_lock do
        if stash.data && stash.data['events']
          orig_cnt = stash.data['events'].length
          stash.data['events'] = stash.data['events'].select{|e| !to_remove["#{e['id']}::#{e['timestamp']}"] }
          stash.save if stash.data['events'] != orig_cnt
        end
      end
    end
  end
end
