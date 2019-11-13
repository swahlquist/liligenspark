class CreateLogSessionBoards < ActiveRecord::Migration[5.0]
  def change
    create_table :log_session_boards do |t|
      t.integer :log_session_id
      t.integer :board_id
      t.timestamps
    end
  end
end
