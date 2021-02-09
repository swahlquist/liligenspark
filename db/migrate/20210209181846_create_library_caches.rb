class CreateLibraryCaches < ActiveRecord::Migration[5.0]
  def change
    create_table :library_caches do |t|
      t.string :library
      t.string :locale
      t.text :data
      t.datetime :invalidated_at
      t.timestamps
    end
    add_index :library_caches, [:library, :locale], :unique => true
  end
end
