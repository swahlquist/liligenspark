class AddIdsToJobStash < ActiveRecord::Migration[5.0]
  def change
    add_column :job_stashes, :log_session_id, :integer
    add_column :job_stashes, :user_id, :integer
    add_index :job_stashes, [:user_id, :log_session_id]
  end
end
