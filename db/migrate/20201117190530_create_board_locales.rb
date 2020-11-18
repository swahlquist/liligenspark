class CreateBoardLocales < ActiveRecord::Migration[5.0]
  def change
    create_table :board_locales do |t|
      t.integer :board_id
      t.integer :popularity
      t.integer :home_popularity
      t.string :locale
      t.string :search_string, limit: 10000
      t.timestamps
    end
  end
end
