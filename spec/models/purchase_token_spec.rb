require 'spec_helper'

describe PurchaseToken, :type => :model do
  describe "map" do
    it "should create the specified token" do
      u = User.create
      PurchaseToken.map('asdf', 'jkl', u)
      expect(PurchaseToken.retrieve('asdf')).to eq(u)
      pt = PurchaseToken.for_device('jkl')
      expect(pt.user).to eq(u)
    end
  end

  describe "retrieve" do
    it "should retrieve the correct token user" do
      u = User.create
      PurchaseToken.map('asdf', 'jkl', u)
      expect(PurchaseToken.retrieve('asdf')).to eq(u)
      expect(PurchaseToken.retrieve('jkl')).to eq(nil)
      PurchaseToken.map('qwer', 'tyop', nil)
      expect(PurchaseToken.retrieve('qwer')).to eq(nil)
      expect(PurchaseToken.retrieve('tyop')).to eq(nil)
    end
  end

  describe "for_device" do
    it "should return the matching token, if any" do
      u = User.create
      PurchaseToken.map('asdf', 'jkl', u)
      expect(PurchaseToken.for_device('asdf')).to eq(nil)
      pt = PurchaseToken.for_device('jkl')
      expect(pt).to_not eq(nil)
      expect(pt.user).to eq(u)
    end
  end
end
