class Add < ActiveRecord::Migration[5.0]
  def change
    add_column :purchase_tokens, :hashed_device_id, :string
    add_index :purchase_tokens, [:hashed_device_id]
  end
end
