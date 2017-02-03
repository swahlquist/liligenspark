class AddIntegrationKeyToUserIntegrations < ActiveRecord::Migration[5.0]
  def change
    add_column :user_integrations, :integration_key, :string
    add_index :user_integrations, [:integration_key], :unique => true
  end
end
