class FixLocaleTrigger < ActiveRecord::Migration[5.0]
  def change
    execute <<-SQL
      DROP TRIGGER tsvectorupdate ON board_locales;
    SQL

    execute <<-SQL
      CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
      ON board_locales FOR EACH ROW EXECUTE PROCEDURE
      tsvector_update_trigger(tsv_search_string, 'pg_catalog.simple', search_string);
    SQL
  end
end
