class BoardContent < ApplicationRecord
  include Async
  include SecureSerialize
  secure_serialize :settings

  before_save :generate_defaults
  # When making a copy of a board, if there is no content offload
  # or there are measurable changes from the current content offload,
  # create a new content offload and link both old and new to it.

  def generate_defaults
    # TODO: freeze changed, these should never be updated
    self.settings ||= {}
    self.settings['board_ids'] ||= []
    self.board_count = self.settings['board_ids'].length
    true
  end

  # Content should store buttons, grid, translations, 
  # intro, background, 
  OFFLOADABLE_ATTRIBUTES=['buttons', 'grid', 'translations', 'intro', 'background']

  def self.generate_from(board)
    # Generate a new content offload from an existing board
    content = BoardContent.new
    attrs = OFFLOADABLE_ATTRIBUTES
    content.settings = {'board_ids' => [board.global_id]}
    # TODO: sharding
    content.source_board_id = board.id
    attrs.each do |attr|
      val = BoardContent.load_content(board, attr)
      content.settings[attr] = val if val
    end
    content.save
    if board.board_content
      # TODO: schedule check to mark content as stale if
      # no one is using it anymore
    end
    board.board_content = content
    attrs.each do |attr|
      board.settings.delete(attr)
    end
    board.settings['content_overrides'] = {}
    board.save
    content
  end

  def self.load_content(board, attr)
    # Load the current state, using the board settings first and
    # the offloaded content second
    raise "unexpected attribute for loading, #{attr}" unless OFFLOADABLE_ATTRIBUTES.include?(attr)
    from_offload = false
    board.settings ||= {}
    res = board.settings[attr] if !board.settings[attr].blank?
    if board.board_content_id && !res
      res = board.board_content.settings[attr].deep_dup
      from_offload = true
    end
    res ||= board.settings[attr]
    if (board.settings['content_overrides'] || {}).has_key?(attr) && from_offload
      over = board.settings['content_overrides'][attr]
      if over == nil && board.settings['content_overrides'].has_key?(attr)
        # If override defined but nil, that means it was cleared
        res = nil unless ['buttons', 'grid'].include?(attr)
      else
        if attr == 'buttons'
          over.each do |id, hash|
            btn = res.detect{|b| b['id'].to_s == id.to_s }
            if btn
              hash.each do |key, val|
                btn[key] = val
                btn.delete(key) if val == nil
              end
              else
              res << hash 
            end
          end
        elsif ['grid', 'intro', 'background', 'translations'].include?(attr)
          over.each do |key, val|
            res[key] = val
            res.delete(key) if val == nil
          end
        end
      end
    end
    res
  end

  def self.attach_as_clone(board)
    # Manually takes an existing board and makes it a clone 
    # of its existing parent board (will also make a clone 
    # of the parent board only if it hasn't already been cloned)
    if board.parent_board
      BoardContent.apply_clone(board.parent_board, board, true)
      board.save!
    end
  end

  def self.apply_clone(original, copy, prevent_new_copy=false)
    # copy=nil when you want to manually offload content as-is
    # prevent_new_copy=true when you want to use existing offloaded content 
    #    (think manually linking legacy copies)
    content = original.board_content
    if !content || (BoardContent.has_changes?(original, content) && !prevent_new_copy)
      # generate a new content offload
      content = BoardContent.generate_from(original)
    end
    if copy
      # use the newly-generated content
      copy.board_content = content
      BoardContent.track_differences(copy, content, true)
    end
  end

  def self.has_changes?(board, content)
    return true if !content || board.board_content_id != content.id
    any_not_blank = false
    (board.settings['content_overrides'] || {}).each do |key, hash|
      any_not_blank = true if !hash.empty?
    end
    return any_not_blank
  end

  def self.track_differences(board, content, skip_save=false)
    if !content
      if board && board.settings && board.settings['content_overrides']
        board.settings.delete('content_overrides')
      end
      return true 
    end
    return false if content.id != board.board_content_id
    changed = false
    if !board.settings['buttons'].blank? && content.settings['buttons']
      board.settings['buttons'].each do |btn|
        offload_btn = content.settings['buttons'].detect{|b| b['id'].to_s == btn['id'].to_s }
        if offload_btn
          btn.each do |key, val|
            revision = {}
            if offload_btn[key] != val
              board.settings['content_overrides'] ||= {}
              board.settings['content_overrides']['buttons'] ||= {}
              board.settings['content_overrides']['buttons'][btn['id'].to_s] ||= {}
              board.settings['content_overrides']['buttons'][btn['id'].to_s][key] = val
              changed = true
            end
          end
          offload_btn.each do |key, val|
            if val && !btn[key]
              board.settings['content_overrides'] ||= {}
              board.settings['content_overrides']['buttons'] ||= {}
              board.settings['content_overrides']['buttons'][btn['id'].to_s] ||= {}
              board.settings['content_overrides']['buttons'][btn['id'].to_s][key] = nil
              changed = true
            end
          end
        else
          board.settings['content_overrides'] ||= {}
          board.settings['content_overrides']['buttons'] ||= {}
          board.settings['content_overrides']['buttons'][btn['id'].to_s] = btn
          changed = true
        end
      end
      board.settings.delete('buttons')
    end
    ['grid', 'intro', 'background', 'translations'].each do |attr|
      if board.settings[attr] == 'delete'
        if content.settings[attr] && attr != 'grid'
          board.settings['content_overrides'] ||= {}
          board.settings['content_overrides'][attr] = nil
          changed = true
        end
        board.settings.delete(attr)
      elsif !board.settings[attr].blank? && content.settings[attr]
        board.settings[attr].each do |key, val|
          if content.settings[attr][key] != val
            board.settings['content_overrides'] ||= {}
            board.settings['content_overrides'][attr] ||= {}
            board.settings['content_overrides'][attr][key] = val
            changed = true
          end
        end
        content.settings[attr].each do |key, val|
          if val && !board.settings[attr][key]
            board.settings['content_overrides'] ||= {}
            board.settings['content_overrides'][attr] ||= {}
            board.settings['content_overrides'][attr][key] = nil
            changed = true
          end
        end
        board.settings.delete(attr)
      end
    end
    board.save if changed && !skip_save
    true
  end
end
