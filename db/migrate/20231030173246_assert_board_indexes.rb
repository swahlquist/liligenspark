class AssertBoardIndexes < ActiveRecord::Migration[5.0]
  # This empty migration includes reference notes for manually creating
  # a new copy of an existing board. If the table gets too much bloat it 
  # may be unrecoverable, in which case creating a clone of it will be
  # the easiest way to remove the bloat
  #
  # disable_ddl_transaction!
  # CREATE TABLE boards_dup as (SELECT * FROM boards);
  def change
    # # NOTE: indexes will say they don't exist, unless you try to create them,
    # # you'll need to remove them first and then re-add them.
    # unless ActiveRecord::Migration.connection.index_name_exists?(:boards, 'boards_search_string2', 'na')
    #   ActiveRecord::Migration.connection.enable_extension "btree_gin"
    #   ActiveRecord::Migration.connection.execute "CREATE INDEX CONCURRENTLY boards_search_string2 ON boards USING GIN(COALESCE(search_string,''::TEXT))"
    #   # add_index "COALESCE(search_string, (''::text)::character varying)", name: "boards_search_string2", using: :gin
    # end
    # unless ActiveRecord::Migration.connection.index_name_exists?(:boards, 'boards_search_string', 'na')
    #   ActiveRecord::Migration.connection.enable_extension "btree_gin"
    #   ActiveRecord::Migration.connection.execute "CREATE INDEX CONCURRENTLY boards_search_string ON boards USING GIN(to_tsvector('simple', COALESCE(search_string::TEXT,'')))"
    #   # add_index "to_tsvector('simple'::regconfig, COALESCE((search_string)::text, ''::text))", name: "boards_search_string", using: :gin
    # end
    # unless ActiveRecord::Migration.connection.index_name_exists?(:boards, 'index_boards_on_key', 'na')
    #   done
    #   ActiveRecord::Migration.connection.add_index :boards, ["key"], name: "index_boards_on_key", unique: true, using: :btree
    # end
    # unless ActiveRecord::Migration.connection.index_name_exists?(:boards, 'index_boards_on_parent_board_id_and_user_id', 'na')
    #   done
    #   ActiveRecord::Migration.connection.add_index :boards, ["parent_board_id", "user_id"], name: "index_boards_on_parent_board_id_and_user_id", using: :btree
    # end
    # unless ActiveRecord::Migration.connection.index_name_exists?(:boards, 'index_boards_on_parent_board_id', 'na')
    #   done
    #   ActiveRecord::Migration.connection.add_index :boards, ["parent_board_id"], name: "index_boards_on_parent_board_id", using: :btree
    # end
    # unless ActiveRecord::Migration.connection.index_name_exists?(:boards, 'board_pop_index', 'na')
    #   done
    #   ActiveRecord::Migration.connection.add_index :boards, ["public", "home_popularity", "popularity", "id"], name: "board_pop_index", using: :btree
    # end
    # unless ActiveRecord::Migration.connection.index_name_exists?(:boards, 'boards_all_pops', 'na')
    #   done
    #   ActiveRecord::Migration.connection.add_index :boards, ["public", "popularity", "home_popularity", "id"], name: "boards_all_pops", using: :btree
    # end
    # unless ActiveRecord::Migration.connection.index_name_exists?(:boards, 'index_boards_on_public_and_user_id', 'na')
    #   done
    #   ActiveRecord::Migration.connection.add_index :boards, ["public", "user_id"], name: "index_boards_on_public_and_user_id", using: :btree
    # end
    # unless ActiveRecord::Migration.connection.index_name_exists?(:boards, 'board_user_index_popularity', 'na')
    #   done
    #   ActiveRecord::Migration.connection.add_index :boards, ["user_id", "popularity", "any_upstream", "id"], name: "board_user_index_popularity", using: :btree
    # end

  # ALTER TABLE boards RENAME TO boards_old;    
  # ALTER TABLE boards_dup RENAME TO boards;    
  # \d boards_old (look for primary key index name, default value)
  # ALTER TABLE boards_old DROP CONSTRAINT boards_pkey;
  # ALTER TABLE boards ADD PRIMARY KEY (id);
  # ALTER TABLE boards ALTER COLUMN id SET DEFAULT nextval('boards_id_seq'::regclass);
  # ALTER SEQUENCE boards_id_seq OWNED BY NONE;
  # ALTER SEQUENCE boards_id_seq OWNED BY boards.id;







  # sql = ["SELECT COUNT(user_id) FROM boards GROUP BY"]
  # res = ActiveRecord::Base.connection.execute(ActiveRecord::Base.send(:sanitize_sql_array, sql))
  # Board.where(id: classes['Board']).having("COUNT(user_id) > 50").group('user_id').count('user_id')
  # sql = ["CREATE TABLE boards_dup as (SELECT * FROM boards)"]
  # DROP INDEX IF EXISTS index_name ON table
  end
end
