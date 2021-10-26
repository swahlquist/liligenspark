class AddUniquePublicProfileId < ActiveRecord::Migration[5.0]
  def change
    remove_index :profile_templates, [:public_profile_id]
    add_index :profile_templates, [:public_profile_id], :unique => true
  end
end
