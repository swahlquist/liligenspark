class CreateRemoteActions < ActiveRecord::Migration[5.0]
  def change
    create_table :remote_actions do |t|
      t.datetime :act_at
      t.string :path
      t.string :action
      t.timestamps
    end
  end
end
