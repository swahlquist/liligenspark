class BoardLocale < ApplicationRecord
  # NOTE: There is a trigger defined within a migration for board_locales that
  # does not show up in schema.rb
  belongs_to :board
  include PgSearch::Model
  pg_search_scope :search_by_text, :against => :search_string, :using => { :tsearch => {dictionary: 'simple', :tsvector_column => 'tsv_search_string'}} #, :ranked_by => "log(board_locales.popularity + board_locales.home_popularity + 3) * :tsearch"
  pg_search_scope :search_by_text_for_home_popularity, :against => :search_string #, :ranked_by => "log(board_locales.home_popularity + 2) * :tsearch"
end
