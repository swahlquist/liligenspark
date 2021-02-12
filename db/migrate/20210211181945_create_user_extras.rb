class CreateUserExtras < ActiveRecord::Migration[5.0]
  def change
    create_table :user_extras do |t|
      t.integer :user_id
      t.text :settings
      t.timestamps
    end
    add_index :user_extras, [:user_id], :unique => true
  end
end
