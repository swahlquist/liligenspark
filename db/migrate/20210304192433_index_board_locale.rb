class IndexBoardLocale < ActiveRecord::Migration[5.0]
  def change
    add_index :board_locales, [:search_string]
  end
end
