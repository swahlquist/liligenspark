class AddSearchIndexes < ActiveRecord::Migration[5.0]
  def change
    add_index :boards, [:public, :user_id]
    add_index :boards, [:search_string]
  end
end
