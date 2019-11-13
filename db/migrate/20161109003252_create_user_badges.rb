class CreateUserBadges < ActiveRecord::Migration[5.0]
  def change
    create_table :user_badges do |t|
      t.integer :user_id
      t.integer :user_goal_id
      t.boolean :superseded
      t.integer :level
      t.text :data
      t.boolean :highlighted
      t.boolean :earned
      t.timestamps null: false
    end
    add_column :users, :badges_updated_at, :datetime
  end
end
