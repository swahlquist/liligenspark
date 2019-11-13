class AddNextNotificationAtToUsers < ActiveRecord::Migration[5.0]
  def change
    add_column :users, :next_notification_at, :datetime
    add_index :users, [:next_notification_at]
  end
end
