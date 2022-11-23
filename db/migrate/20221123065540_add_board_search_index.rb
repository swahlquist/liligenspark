class AddBoardSearchIndex < ActiveRecord::Migration[5.0]
  def change
    add_index 'boards', ["public", "popularity", "home_popularity", "id"], :name => 'boards_all_pops'
  end
end
