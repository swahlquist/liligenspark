class CreateUserBoardConnections < ActiveRecord::Migration[5.0]
  def change
    create_table :user_board_connections do |t|
      t.integer :user_id
      t.integer :board_id
      t.boolean :home
      t.timestamps
    end
    add_index :user_board_connections, [:board_id, :home, :updated_at], :name => :user_board_lookups
  end
end
