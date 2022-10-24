class RemoveUnusedIndexes2022 < ActiveRecord::Migration[5.0]
  def change
    remove_index 'log_session_boards', ["board_id", "log_session_id"]
    remove_index 'log_sessions', ["geo_cluster_id", "user_id"]
    remove_index 'log_sessions', ["ip_cluster_id", "user_id"]
    remove_index 'log_sessions', ["needs_remote_push"]
    remove_index 'boards', ["public", "popularity", "home_popularity", "id"]
    remove_index 'button_images', ["file_hash"]
    remove_index 'button_images', ["removable"]
  end
end
