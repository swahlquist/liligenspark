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
