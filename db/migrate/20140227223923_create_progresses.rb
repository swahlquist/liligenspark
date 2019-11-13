class CreateProgresses < ActiveRecord::Migration[5.0]
  def change
    create_table :progresses do |t|
      t.text :settings
      t.string :nonce
      t.datetime :started_at
      t.datetime :finished_at

      t.timestamps
    end
    add_index :progresses, [:nonce]
  end
end
