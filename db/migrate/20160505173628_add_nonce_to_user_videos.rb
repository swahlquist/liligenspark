class AddNonceToUserVideos < ActiveRecord::Migration[5.0]
  def change
    add_column :user_videos, :nonce, :string
  end
end
