class AddBoardUpdatedAtToUsers < ActiveRecord::Migration[5.0]
  def change
    add_column :users, :boards_updated_at, :datetime
    User.all.update_all('boards_updated_at = updated_at')
  end
end
