class AddBoardIdIndexToBoardLocales < ActiveRecord::Migration[5.0]
  def change
    add_index :board_locales, [:board_id, :locale], unique: true
  end
end
