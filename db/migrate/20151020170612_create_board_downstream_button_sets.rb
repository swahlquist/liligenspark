class CreateBoardDownstreamButtonSets < ActiveRecord::Migration[5.0]
  def change
    create_table :board_downstream_button_sets do |t|
      t.text :data
      t.integer :board_id
      t.timestamps
    end
    
    add_index :board_downstream_button_sets, [:board_id], :unique => true
  end
end
