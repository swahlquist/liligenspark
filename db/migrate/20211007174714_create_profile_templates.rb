class CreateProfileTemplates < ActiveRecord::Migration[5.0]
  def change
    create_table :profile_templates do |t|
      t.integer :user_id
      t.integer :organization_id
      t.integer :parent_id
      t.text :profile
      t.timestamps
    end
    add_column :log_sessions, :profile_id, :string
  end
end
