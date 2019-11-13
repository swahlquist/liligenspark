class AddPrimaryToUserGoals < ActiveRecord::Migration[5.0]
  def change
    add_column :user_goals, :primary, :boolean
  end
end
