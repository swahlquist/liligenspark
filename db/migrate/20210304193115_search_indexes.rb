class SearchIndexes < ActiveRecord::Migration[5.0]
  disable_ddl_transaction!
  def change
    enable_extension "btree_gin"
    remove_index :board_locales, [:search_string]
    add_index :boards, [:search_string], :using => :gin, algorithm: :concurrently
    add_index :board_locales, [:search_string], :using => :gin, algorithm: :concurrently
  end
end
