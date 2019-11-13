class CreateUtterances < ActiveRecord::Migration[5.0]
  def change
    create_table :utterances do |t|
      t.text :data
      t.integer :user_id
      t.timestamps
    end
  end
end
