class CreateBoardContents < ActiveRecord::Migration[5.0]
  def change
    create_table :board_contents do |t|
      t.text :settings
      t.integer :board_count
      t.integer :source_board_id
      t.timestamps
    end
    add_column :boards, :board_content_id, :integer
  end
end
