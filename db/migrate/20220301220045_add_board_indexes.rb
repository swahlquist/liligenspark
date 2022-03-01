class AddBoardIndexes < ActiveRecord::Migration[5.0]
  disable_ddl_transaction!
  def change
    add_index :boards, [:public, :popularity, :home_popularity, :id], algorithm: :concurrently
    add_index :boards, [:user_id, :popularity, :any_upstream, :id], algorithm: :concurrently
  end
end
