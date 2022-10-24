class RemovePossiblySlowingIndex < ActiveRecord::Migration[5.0]
  def change
    remove_index :board_locales, [:board_id, :locale]
  end
end
