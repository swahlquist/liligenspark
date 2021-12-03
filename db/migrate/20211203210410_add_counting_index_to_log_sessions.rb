class AddCountingIndexToLogSessions < ActiveRecord::Migration[5.0]
  disable_ddl_transaction!
  def change
    add_index :log_sessions, [:started_at, :log_type], algorithm: :concurrently
  end
end
