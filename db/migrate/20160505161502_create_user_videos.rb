class CreateUserVideos < ActiveRecord::Migration[5.0]
  def change
    create_table :user_videos do |t|
      t.integer :user_id
      t.string :url, :limit => 4096
      t.text :settings
      t.string :file_hash
      t.boolean :public

      t.timestamps null: false
    end
  end
end
