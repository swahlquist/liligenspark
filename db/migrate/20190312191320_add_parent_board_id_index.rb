class AddParentBoardIdIndex < ActiveRecord::Migration[5.0]
  def change
    add_index :boards, [:parent_board_id]
  end
end
