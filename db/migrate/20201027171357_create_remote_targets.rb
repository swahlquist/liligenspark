class CreateRemoteTargets < ActiveRecord::Migration[5.0]
  def change
    create_table :remote_targets do |t|
      t.string :target_type
      t.string :source_hash
      t.string :target_hash
      t.string :salt
      t.integer :user_id
      t.integer :target_id
      t.integer :target_index
      t.string :contact_id
      t.datetime :last_outbound_at
      t.timestamps
    end
    add_index :remote_targets, [:target_type, :target_id, :target_index], :name => "remote_targets_target_sorting"
  end
end
