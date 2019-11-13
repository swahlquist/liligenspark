class AddRemovableToImagesAndSounds < ActiveRecord::Migration[5.0]
  def change
    add_column :button_images, :removable, :boolean
    add_column :button_sounds, :removable, :boolean
    add_index :button_images, [:removable]
    add_index :button_images, [:url]
    add_index :button_sounds, [:removable]
    add_index :button_sounds, [:url]
  end
end
