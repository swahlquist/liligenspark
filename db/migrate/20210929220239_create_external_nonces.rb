class CreateExternalNonces < ActiveRecord::Migration[5.0]
  def change
    create_table :external_nonces do |t|
      t.string :purpose
      t.string :nonce
      t.string :transform
      t.timestamps
    end
  end
end
