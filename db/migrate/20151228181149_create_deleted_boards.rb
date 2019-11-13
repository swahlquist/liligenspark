class CreateDeletedBoards < ActiveRecord::Migration[5.0]
  def change
    create_table :deleted_boards do |t|
      t.string :key
      t.text :settings
      t.integer :board_id
      t.integer :user_id
      t.boolean :cleared
      t.timestamps
    end
    add_index :deleted_boards, [:key]
    add_index :deleted_boards, [:board_id], :unique => true
    add_index :deleted_boards, [:user_id]
    add_index :deleted_boards, [:created_at, :cleared]
  end
end
