class AddPriorityToWordData < ActiveRecord::Migration[5.0]
  def change
    add_column :word_data, :priority, :integer
    add_index :word_data, [:locale, :priority, :word]
  end
end
