class AddParentBoardIdToUserBoardConnections < ActiveRecord::Migration[5.0]
  def change
    add_column :user_board_connections, :parent_board_id, :integer
  end
end
