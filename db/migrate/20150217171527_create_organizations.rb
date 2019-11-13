class CreateOrganizations < ActiveRecord::Migration[5.0]
  def change
    create_table :organizations do |t|
      t.text :settings
      t.boolean :admin
      t.timestamps
    end
    add_column :users, :managing_organization_id, :integer
    add_column :users, :managed_organization_id, :integer
    add_index :users, [:managing_organization_id]
    add_index :users, [:managed_organization_id]
    add_index :organizations, [:admin], :unique => true
  end
end
