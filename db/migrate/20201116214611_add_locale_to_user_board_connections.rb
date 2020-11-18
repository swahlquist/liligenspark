class AddLocaleToUserBoardConnections < ActiveRecord::Migration[5.0]
  def change
    add_column :user_board_connections, :locale, :string
    # This is slow but important for existing builds. This can be run 
    # more than once if needed and will pick up where it left off
    board_ids = []
    UserBoardConnection.where('locale IS NULL').select('id, board_id').find_in_batches(batch_size: 5000) do |batch|
      puts "..."
      board_ids += batch.map(&:board_id)
    end
    board_ids.uniq!; board_ids.length
    Board.where(id: board_ids, public: true).select('id').find_in_batches(batch_size: 200) do |batch|
      Board.schedule(:refresh_stats, batch.map(&:global_id))
      # puts "..."
      # batch.each do |board|
      #   UserBoardConnection.where(board_id: board.id).update_all(locale: board.settings['locale'] || 'en') if board.settings
      # end
    end
    Board.where(['popularity > ?', 0]).where(public: true).select('id').find_in_batches(batch_size: 200) do |batch|
      Board.schedule(:refresh_stats, batch.map(&:global_id))
    end
  end
end
