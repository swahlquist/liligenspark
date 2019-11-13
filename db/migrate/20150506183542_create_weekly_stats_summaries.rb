class CreateWeeklyStatsSummaries < ActiveRecord::Migration[5.0]
  def change
    create_table :weekly_stats_summaries do |t|
      t.integer :user_id
      t.integer :board_id
      t.integer :weekyear
      t.text :data
      t.timestamps
    end
    add_index :weekly_stats_summaries, [:user_id, :weekyear]
    add_index :weekly_stats_summaries, [:board_id, :weekyear]
  end
end
