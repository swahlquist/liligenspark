class AddNonceToUtterances < ActiveRecord::Migration[5.0]
  def change
    add_column :utterances, :nonce, :string
  end
end
