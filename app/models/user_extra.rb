class UserExtra < ApplicationRecord
  belongs_to :user

  include GlobalId
  include SecureSerialize

  secure_serialize :settings
  before_save :generate_defaults

  def generate_defaults
    self.settings ||= {}
    true
  end

  def process_focus_words(hash)
    merged = {}
    existing = self.settings['focus_words'] || {}
    hash.each do |name, opts|
      if existing[name]
        if opts['updated'] > existing[name]['updated'] - 60 && !opts['deleted'] && opts['updated'] > (existing[name]['deleted'] || 60) - 60
          existing[name]['updated'] = opts['updated']
          existing[name].delete('deleted')
          existing[name]['words'] = opts['words']
        elsif opts['deleted'] > existing[name]['updated'] - 60
          existing[name]['deleted'] = opts['deleted']
        end
      else
        existing[name] = opts
      end
    end
    existing.each do |name, opts|
      existing.delete(name) if opts['deleted'] && opts['deleted'] < 48.hours.ago.to_i
    end
    self.settings['focus_words'] = existing
    self.save
  end

  def active_focus_words
    res = {}
    (self.settings['focus_words'] || {}).to_a.select{|name, opts| !opts['deleted']}.sort_by{|name, opts| opts['updated'] || 0 }.each do |name, opts|
      res[name] = opts
    end
    res
  end

  def tag_board(board, tag, remove, downstream)
    return nil unless board && board.global_id && !tag.blank?
    self.settings['board_tags'] ||= {}
    if remove == true || remove == 'true'
      if self.settings['board_tags'][tag]
        self.settings['board_tags'][tag] = self.settings['board_tags'][tag].select{|id| id != board.global_id }
      end
    else
      self.settings['board_tags'][tag] ||= []
      self.settings['board_tags'][tag] << board.global_id
      if downstream == true || downstream == 'true'
        self.settings['board_tags'][tag] += board.settings['downstream_board_ids'] || []
      end
      self.settings['board_tags'][tag].uniq!
    end
    self.settings['board_tags'].each do |k, list|
      self.settings['board_tags'].delete(k) if !list || list.empty?  
    end
    self.save!
    self.settings['board_tags'].keys.sort
  end
end
