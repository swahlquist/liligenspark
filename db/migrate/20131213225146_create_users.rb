class CreateUsers < ActiveRecord::Migration[5.0]
  def change
    create_table :users do |t|
      t.string :user_name
      t.string :email_hash, :limit => 4096
      t.text :settings
      
      t.timestamps
    end
    add_index :users, [:user_name], :unique => true
    add_index :users, [:email_hash]
  end
end
