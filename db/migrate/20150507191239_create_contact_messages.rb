class CreateContactMessages < ActiveRecord::Migration[5.0]
  def change
    create_table :contact_messages do |t|
      t.text :settings
      t.timestamps
    end
  end
end
