class AddScoreToLogSessions < ActiveRecord::Migration[5.0]
  def change
    add_column :log_sessions, :score, :integer
  end
end
