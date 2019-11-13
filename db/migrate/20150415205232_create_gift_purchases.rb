class CreateGiftPurchases < ActiveRecord::Migration[5.0]
  def change
    create_table :gift_purchases do |t|
      t.text :settings
      t.boolean :active
      t.string :code
      t.timestamps
    end
    add_index :gift_purchases, [:code], :unique => true
    add_index :gift_purchases, [:active, :code]
  end
end
