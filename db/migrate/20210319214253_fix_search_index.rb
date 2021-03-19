class FixSearchIndex < ActiveRecord::Migration[5.0]
  disable_ddl_transaction!
  def change
    enable_extension "btree_gin"
    remove_index :boards, [:search_string]
    remove_index :board_locales, [:search_string]
    execute "CREATE INDEX CONCURRENTLY boards_search_string ON boards USING GIN(to_tsvector('simple', COALESCE(search_string::TEXT,'')))"
    execute "CREATE INDEX CONCURRENTLY board_locales_search_string ON board_locales USING GIN(to_tsvector('simple', COALESCE(search_string::TEXT,'')))"
  end
end
