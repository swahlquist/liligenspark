class AddExtraToRemoteActions < ActiveRecord::Migration[5.0]
  def change
    add_column :remote_actions, :extra, :string
  end
end
