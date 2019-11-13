class CreateDevices < ActiveRecord::Migration[5.0]
  def change
    create_table :devices do |t|
      t.integer :user_id
      # it's possible to have multiple users on the same device
      t.string :device_key
      t.text :settings
      
      t.timestamps
    end
    add_index :devices, [:user_id]
  end
end
