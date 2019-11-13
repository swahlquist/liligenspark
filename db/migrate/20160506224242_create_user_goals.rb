class CreateUserGoals < ActiveRecord::Migration[5.0]
  def change
    create_table :user_goals do |t|
      t.integer :user_id
      t.boolean :active
      t.text :settings
      t.boolean :template
      t.boolean :template_header
      t.datetime :advance_at
      t.timestamps null: false
    end
    add_index :user_goals, [:user_id, :active]
    add_index :user_goals, [:advance_at]
    add_index :user_goals, [:template_header]
  end
end
