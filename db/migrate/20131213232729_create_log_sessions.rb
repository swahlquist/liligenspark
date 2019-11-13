class CreateLogSessions < ActiveRecord::Migration[5.0]
  def change
    create_table :log_sessions do |t|
      t.integer :user_id
      t.integer :author_id
      t.integer :device_id
      t.datetime :started_at
      t.datetime :ended_at
      t.text :data
      t.boolean :processed
      t.timestamps
    end
    add_index :log_sessions, [:user_id, :started_at]
    add_index :log_sessions, [:device_id, :ended_at]
  end
end
