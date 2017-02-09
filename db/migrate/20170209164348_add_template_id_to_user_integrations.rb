class AddTemplateIdToUserIntegrations < ActiveRecord::Migration[5.0]
  def change
    add_column :user_integrations, :template_id, :integer
    add_index :user_integrations, [:template_id, :user_id]
  end
end
