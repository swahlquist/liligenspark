class CreateLogSnapshots < ActiveRecord::Migration[5.0]
  def change
    create_table :log_snapshots do |t|
      t.integer :user_id
      t.datetime :started_at
      t.text :settings

      t.timestamps null: false
    end
    add_index :log_snapshots, [:user_id, :started_at]
  end
end
