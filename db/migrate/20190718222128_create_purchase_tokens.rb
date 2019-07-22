class CreatePurchaseTokens < ActiveRecord::Migration[5.0]
  def change
    create_table :purchase_tokens do |t|
      t.string :token
      t.integer :user_id
      t.timestamps
    end
    add_index :purchase_tokens, [:token], :unique => true
  end
end
