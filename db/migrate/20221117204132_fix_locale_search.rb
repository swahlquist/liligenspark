class FixLocaleSearch < ActiveRecord::Migration[5.0]
  disable_ddl_transaction!
  def change
    enable_extension "btree_gin"

    remove_index :board_locales, name: :board_locales_search_string3

    # Adds a tsvector column for the body
    add_column :board_locales, :tsv_search_string, :tsvector

    # Adds an index for this new column
    execute <<-SQL
      CREATE INDEX CONCURRENTLY index_board_locales_tsv_search_string ON board_locales USING gin(tsv_search_string);
    SQL

    # Updates existing rows so this new column gets calculated
    execute <<-SQL
      UPDATE board_locales SET tsv_search_string = (to_tsvector('simple', coalesce(search_string, '')));
    SQL

    # Sets up a trigger to update this new column on inserts and updates
    execute <<-SQL
      CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
      ON board_locales FOR EACH ROW EXECUTE PROCEDURE
      tsvector_update_trigger(tsv_search_string, 'pg_catalog.simple', board_locales);
    SQL

    # execute "CREATE INDEX CONCURRENTLY board_locales_search_string3 ON board_locales USING GIN(COALESCE(search_string::TEXT,''::TEXT))"  
    # (ts_rank(to_tsvector('simple'::regconfig, COALESCE((board_locales_1.search_string)::text, ''::text)), '''core'''::tsquery, 0))
    # execute "CREATE INDEX CONCURRENTLY board_locales_search_string3 ON board_locales USING GIN(to_tsvector('simple', COALESCE(search_string::TEXT, ''))"
    # execute "CREATE INDEX CONCURRENTLY board_locales_search_string4 ON board_locales USING GIN((to_tsvector('simple', coalesce(\"board_locales\".\"search_string\"::text, ''))))"
    # t.index "to_tsvector('simple'::regconfig, COALESCE((search_string)::text, ''::text))", name: "board_locales_search_string", using: :gin

    # res = ActiveRecord::Base.connection.execute(ActiveRecord::Base.send(:sanitize_sql_array, sql))

  end
end
