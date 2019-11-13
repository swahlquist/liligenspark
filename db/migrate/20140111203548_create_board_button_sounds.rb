class CreateBoardButtonSounds < ActiveRecord::Migration[5.0]
  def change
    create_table :board_button_sounds do |t|
      t.integer :button_sound_id
      t.integer :board_id
      
      t.timestamps
    end
    add_index :board_button_sounds, [:board_id]
  end
end
