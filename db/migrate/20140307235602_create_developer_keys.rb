class CreateDeveloperKeys < ActiveRecord::Migration[5.0]
  def change
    create_table :developer_keys do |t|
      t.string :key
      t.string :redirect_uri, :limit => 4096
      t.string :name
      t.string :secret, :limit => 4096
      t.string :icon_url, :limit => 4096
      t.timestamps
    end
  end
end
