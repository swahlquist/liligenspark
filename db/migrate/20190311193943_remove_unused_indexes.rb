class RemoveUnusedIndexes < ActiveRecord::Migration[5.0]
  def change
    remove_index :button_images, [:url]
    remove_index :log_sessions, [:user_id, :log_type, :has_notes, :started_at]
    remove_index :log_sessions, [:user_id, :log_type, :started_at]
    remove_index :boards, [:public, :popularity, :any_upstream, :id]
    remove_index :boards, [:search_string]
    remove_index :boards, [:popularity, :any_upstream]
    remove_index :boards, [:popularity]
    remove_index :boards, [:home_popularity]
  end
end
