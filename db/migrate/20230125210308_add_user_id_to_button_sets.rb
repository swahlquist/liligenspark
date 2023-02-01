class AddUserIdToButtonSets < ActiveRecord::Migration[5.0]
  def change
    add_column :board_downstream_button_sets, :user_id, :integer
    remove_index :board_downstream_button_sets, [:board_id]
    add_index :board_downstream_button_sets, [:board_id, :user_id], :unique => true
  end
end
