class CreateButtonSounds < ActiveRecord::Migration[5.0]
  def change
    create_table :button_sounds do |t|
      t.integer :board_id
      t.integer :remote_id
      t.integer :user_id
      t.boolean :public
      t.string :path
      t.string :url, :limit => 4096
      t.text :data
      t.text :settings
      t.string :file_hash
      
      t.timestamps
    end
    add_index :button_sounds, [:file_hash]
  end
end
