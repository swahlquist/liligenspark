class CreateUserIntegrations < ActiveRecord::Migration[5.0]
  def change
    create_table :user_integrations do |t|
      t.integer :user_id
      t.integer :device_id
      t.boolean :template
      t.text :settings
      t.timestamps null: false
    end
    add_column :devices, :user_integration_id, :integer
    add_column :webhooks, :user_integration_id, :integer
    add_index :user_integrations, [:user_id, :created_at]
    add_index :user_integrations, [:template]
  end
end
