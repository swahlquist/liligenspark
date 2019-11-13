class AddLastClusterAttemptToLogSessions < ActiveRecord::Migration[5.0]
  def change
    add_column :log_sessions, :last_cluster_attempt_at, :datetime
  end
end
