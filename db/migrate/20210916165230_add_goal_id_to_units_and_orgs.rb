class AddGoalIdToUnitsAndOrgs < ActiveRecord::Migration[5.0]
  def change
    add_column :organization_units, :user_goal_id, :integer
    add_column :organizations, :user_goal_id, :integer
  end
end
