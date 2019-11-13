class AddGlobalToUserGoals < ActiveRecord::Migration[5.0]
  def change
    add_column :user_goals, :global, :boolean
    add_index :user_goals, [:global]
  end
end
