class AddUrlIndexToButtonImages < ActiveRecord::Migration[5.0]
  def change
    add_index :button_images, [:url]
  end
end
