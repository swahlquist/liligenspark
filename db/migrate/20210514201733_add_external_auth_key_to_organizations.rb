class AddExternalAuthKeyToOrganizations < ActiveRecord::Migration[5.0]
  def change
    add_column :organizations, :external_auth_key, :string
    add_column :organizations, :external_auth_shortcut, :string
    add_index :organizations, [:external_auth_key], :unique => true
    add_index :organizations, [:external_auth_shortcut], :unique => true
  end
end
