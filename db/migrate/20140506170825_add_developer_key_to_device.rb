class AddDeveloperKeyToDevice < ActiveRecord::Migration[5.0]
  def change
    add_column :devices, :developer_key_id, :integer
  end
end
