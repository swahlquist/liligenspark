class AddUniqueIndexForDeveloperKey < ActiveRecord::Migration[5.0]
  def change
    add_index :developer_keys, [:key], :unique => true
  end
end
