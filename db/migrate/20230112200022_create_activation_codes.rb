class CreateActivationCodes < ActiveRecord::Migration[5.0]
  def change
    create_table :activation_codes do |t|
      t.string :code_hash
      t.string :record_code
      t.timestamps
    end
    add_index :activation_codes, [:code_hash], unique: true
  end
end
