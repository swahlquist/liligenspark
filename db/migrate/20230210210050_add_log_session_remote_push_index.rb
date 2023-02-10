class AddLogSessionRemotePushIndex < ActiveRecord::Migration[5.0]
  def change
    add_index :log_sessions, [:needs_remote_push, :ended_at]
  end
end
