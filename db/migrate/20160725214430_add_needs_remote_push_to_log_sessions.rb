class AddNeedsRemotePushToLogSessions < ActiveRecord::Migration[5.0]
  def change
    add_column :log_sessions, :needs_remote_push, :boolean
    add_index :log_sessions, [:needs_remote_push]
  end
end
