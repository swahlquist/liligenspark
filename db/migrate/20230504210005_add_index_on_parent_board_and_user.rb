class AddIndexOnParentBoardAndUser < ActiveRecord::Migration[5.0]
  def change
    add_index :boards, [:parent_board_id, :user_id]
  end
end
