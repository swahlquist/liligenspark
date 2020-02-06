class AddSyncStampToUsers < ActiveRecord::Migration[5.0]
  def change
    add_column :users, :sync_stamp, :datetime
    User.update_all('sync_stamp = updated_at')
  end
end
