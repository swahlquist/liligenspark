class AddTemplateIntegrationId < ActiveRecord::Migration[5.0]
  def change
    remove_index :user_integrations, [:template_id, :user_id]
    remove_column :user_integrations, :template_id, :integer
    add_column :user_integrations, :template_integration_id, :integer
    add_index :user_integrations, [:template_integration_id, :user_id]
  end
end
