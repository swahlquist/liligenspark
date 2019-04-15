class AddCustomDomainToOrganizations < ActiveRecord::Migration[5.0]
  def change
    add_column :organizations, :custom_domain, :boolean
    add_index :organizations, [:custom_domain]
  end
end
