class AddNoncesToImagesAndSounds < ActiveRecord::Migration[5.0]
  def change
    add_column :button_images, :nonce, :string
    add_column :button_sounds, :nonce, :string
    ButtonImage.update_all(:nonce => "legacy")
    ButtonSound.update_all(:nonce => "legacy")
  end
end
