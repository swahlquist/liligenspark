class AddLocaleIndexAgain < ActiveRecord::Migration[5.0]
  disable_ddl_transaction!
  def change
    enable_extension "btree_gin"
    execute "CREATE INDEX CONCURRENTLY board_locales_search_string2 ON board_locales USING GIN(COALESCE(search_string::TEXT,''::TEXT))"

    # (ts_rank(to_tsvector('simple'::regconfig, COALESCE((board_locales_1.search_string)::text, ''::text)), '''core'''::tsquery, 0))
    # execute "CREATE INDEX CONCURRENTLY board_locales_search_string3 ON board_locales USING GIN(to_tsvector('simple', COALESCE(search_string::TEXT, ''))"
  end
end

# execute "CREATE INDEX CONCURRENTLY board_locales_search_string ON board_locales USING GIN(to_tsvector('simple', COALESCE(search_string::TEXT,'')))"

# (to_tsvector('simple', COALESCE(search_string::TEXT,'')))"
# (to_tsvector($10, coalesce("board_locales"."search_string"::text, $11))) @@ (to_tsquery($12, $13 || $14 || $15)))) AS pg_search_22863c2f77c659ca239031
# SELECT board_locales.*,
#          pg_search_22863c2f77c659ca239031.rank AS pg_search_rank
# FROM "board_locales"
# INNER JOIN 
#     (SELECT "board_locales"."id" AS pg_search_id,
#          log(board_locales.popularity + board_locales.home_popularity + $2) * (ts_rank((to_tsvector($3,
#          coalesce("board_locales"."search_string"::text,
#          $4))),
#          (to_tsquery($5,
#          $6 || $7 || $8)),
#          $9)) AS rank
#     FROM "board_locales"
#     WHERE (
#       (to_tsvector($10, coalesce("board_locales"."search_string"::text, $11))) @@ (to_tsquery($12, $13 || $14 || $15)))) AS pg_search_22863c2f77c659ca239031
#     ON "board_locales"."id" = pg_search_22863c2f77c659ca239031.pg_search_id
# ORDER BY  pg_search_22863c2f77c659ca239031.rank DESC, "board_locales"."id" ASC LIMIT $1