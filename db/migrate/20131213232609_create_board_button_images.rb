class CreateBoardButtonImages < ActiveRecord::Migration[5.0]
  def change
    create_table :board_button_images do |t|
      t.integer :button_image_id
      t.integer :board_id
      
      t.timestamps
    end
    add_index :board_button_images, [:board_id]
  end
end
