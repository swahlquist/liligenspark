class AddFiltersToProfileTemplates < ActiveRecord::Migration[5.0]
  def change
    add_column :profile_templates, :communicator, :boolean
  end
end
