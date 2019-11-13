class AddDisabledToUserBadges < ActiveRecord::Migration[5.0]
  def change
    add_column :user_badges, :disabled, :boolean
    add_index :user_badges, [:disabled]
    UserBadge.update_all(:disabled => false)
  end
end
