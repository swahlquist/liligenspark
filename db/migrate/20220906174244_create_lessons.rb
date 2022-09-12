class CreateLessons < ActiveRecord::Migration[5.0]
  def change
    create_table :lessons do |t|
      t.text :settings
      t.integer :user_id
      t.integer :organization_id
      t.integer :organization_unit_id
      t.boolean :public
      t.integer :popularity
      t.timestamps
    end
  end
end
