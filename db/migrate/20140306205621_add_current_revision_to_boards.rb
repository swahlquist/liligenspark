class AddCurrentRevisionToBoards < ActiveRecord::Migration[5.0]
  def change
    add_column :boards, :current_revision, :string
  end
end
