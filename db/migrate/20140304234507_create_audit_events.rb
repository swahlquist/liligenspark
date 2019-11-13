class CreateAuditEvents < ActiveRecord::Migration[5.0]
  def change
    create_table :audit_events do |t|
      t.string :user_key
      t.text :data
      t.string :summary, :limit => 4096

      t.timestamps
    end
    add_index :audit_events, [:user_key, :created_at]
  end
end
