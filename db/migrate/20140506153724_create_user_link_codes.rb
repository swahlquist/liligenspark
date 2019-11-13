class CreateUserLinkCodes < ActiveRecord::Migration[5.0]
  def change
    create_table :user_link_codes do |t|
      t.integer :user_id
      t.string :user_global_id
      t.string :code
      t.timestamps
    end
    add_index :user_link_codes, [:code], :unique => true
  end
end
