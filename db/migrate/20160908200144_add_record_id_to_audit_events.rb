class AddRecordIdToAuditEvents < ActiveRecord::Migration[5.0]
  def change
    add_column :audit_events, :record_id, :string
    add_index :audit_events, [:event_type, :record_id]
  end
end
