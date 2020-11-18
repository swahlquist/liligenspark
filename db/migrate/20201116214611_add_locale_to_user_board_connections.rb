class AddLocaleToUserBoardConnections < ActiveRecord::Migration[5.0]
  def change
    add_column :user_board_connections, :locale, :string
    # Board.all.select('id, settings').find_in_batches(batch_size: 1000) do |batch|
    #   puts "..."
    #   batch.each do |board|
    #     UserBoardConnection.where(board_id: board.id).update_all(locale: board.settings['locale'] || 'en') if board.settings
    #   end
    # end
    Board.where(['popularity > ?', 0]).where(public: true).select('id').find_in_batches(batch_size: 200) do |batch|
      Board.schedule(:refresh_stats, batch.map(&:global_id))
    end
  end
end
