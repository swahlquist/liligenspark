class AddReviewsToWordData < ActiveRecord::Migration[5.0]
  def change
    add_column :word_data, :reviews, :integer
    add_index :word_data, [:locale, :reviews, :priority, :word]
  end
end
