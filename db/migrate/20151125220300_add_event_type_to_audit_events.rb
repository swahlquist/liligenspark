class AddEventTypeToAuditEvents < ActiveRecord::Migration[5.0]
  def change
    add_column :audit_events, :event_type, :string
    add_index :audit_events, [:event_type, :created_at]
  end
end
