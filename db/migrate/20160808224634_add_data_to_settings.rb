class AddDataToSettings < ActiveRecord::Migration[5.0]
  def change
    add_column :settings, :data, :text
  end
end
