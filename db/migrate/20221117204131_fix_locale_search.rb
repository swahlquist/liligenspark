class FixLocaleSearch < ActiveRecord::Migration[5.0]
  disable_ddl_transaction!
  def change
    enable_extension "btree_gin"
    remove_index :board_locales, name: :board_locales_search_string3
    # execute "CREATE INDEX CONCURRENTLY board_locales_search_string3 ON board_locales USING GIN(COALESCE(search_string::TEXT,''::TEXT))"  
    # (ts_rank(to_tsvector('simple'::regconfig, COALESCE((board_locales_1.search_string)::text, ''::text)), '''core'''::tsquery, 0))
    # execute "CREATE INDEX CONCURRENTLY board_locales_search_string3 ON board_locales USING GIN(to_tsvector('simple', COALESCE(search_string::TEXT, ''))"
    execute "CREATE INDEX CONCURRENTLY board_locales_search_string4 ON board_locales USING GIN((to_tsvector('simple', coalesce(\"board_locales\".\"search_string\"::text, ''))))"
    # t.index "to_tsvector('simple'::regconfig, COALESCE((search_string)::text, ''::text))", name: "board_locales_search_string", using: :gin

    # res = ActiveRecord::Base.connection.execute(ActiveRecord::Base.send(:sanitize_sql_array, sql))

  end
end
