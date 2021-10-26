class AddSettingsToProfileTemplates < ActiveRecord::Migration[5.0]
  def change
    add_column :profile_templates, :settings, :text
    remove_column :profile_templates, :profile
    add_column :profile_templates, :public_profile_id, :string
    add_index :profile_templates, [:public_profile_id]
  end
end
