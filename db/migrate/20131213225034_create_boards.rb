class CreateBoards < ActiveRecord::Migration[5.0]
  def change
    create_table :boards do |t|
      t.string :name
      t.string :key
      t.string :search_string, :limit => 4096
      t.boolean :public
      t.text :settings
      t.integer :parent_board_id
      t.integer :user_id
      t.integer :popularity
      t.integer :home_popularity
      
      t.timestamps
    end
    add_index :boards, [:key], :unique => true
    add_index :boards, [:popularity]
    add_index :boards, [:home_popularity]
  end
end
