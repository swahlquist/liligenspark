class CreateApiCalls < ActiveRecord::Migration[5.0]
  def change
    create_table :api_calls do |t|
      t.integer :user_id
      t.text :data
      t.timestamps
    end
  end
end
