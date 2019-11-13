class CreateWebhooks < ActiveRecord::Migration[5.0]
  def change
    create_table :webhooks do |t|
      t.integer :user_id
      t.string :record_code
      t.text :settings
      t.timestamps
    end
    add_index :webhooks, [:record_code, :user_id]
    add_index :webhooks, [:user_id]
  end
end
