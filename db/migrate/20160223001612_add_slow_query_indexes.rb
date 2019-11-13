class AddSlowQueryIndexes < ActiveRecord::Migration[5.0]
  def change
    add_index :boards, [:public, :popularity, :any_upstream, :id]
    add_index :log_sessions, [:ip_cluster_id, :user_id]
    add_index :log_sessions, [:geo_cluster_id, :user_id]
  end
end
