class AddUserIdIndexToConnections < ActiveRecord::Migration[5.0]
  def change
    add_index :user_board_connections, [:user_id, :board_id]
  end
end
