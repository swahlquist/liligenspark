class AddUsesToExternalNonces < ActiveRecord::Migration[5.0]
  def change
    add_column :external_nonces, :uses, :integer
  end
end
