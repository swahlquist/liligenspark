class AddSlowBoardQueryIndexes < ActiveRecord::Migration[5.0]
  def change
    add_index :boards, ['public', 'home_popularity', 'popularity', 'id'], :name => 'board_pop_index'
    add_index :log_session_boards, ['board_id', 'log_session_id']
    add_index :log_sessions, ['author_id']
  end
end
