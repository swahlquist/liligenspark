class CreateOldKeys < ActiveRecord::Migration[5.0]
  def change
    create_table :old_keys do |t|
      t.string :record_id
      t.string :type
      t.string :key
      t.timestamps
    end
    add_index :old_keys, [:type, :key]
  end
end
