class CreateWordData < ActiveRecord::Migration
  def change
    create_table :word_data do |t|
      t.string :word
      t.string :locale
      t.text :data
      t.timestamps
    end
    add_index :word_data, [:word, :locale]
  end
end
