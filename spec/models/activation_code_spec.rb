require 'spec_helper'

describe ActivationCode, :type => :model do
  describe "lookup" do
    it "should find by code hash" do
      hash = ActivationCode.code_hash('whatever')
      expect(ActivationCode).to receive(:find_by).with(code_hash: hash).and_return(nil)
      ActivationCode.lookup('whatever')
    end
  end

  describe "code_hash" do
    it "should hash the code correctly" do
      hash = GoSecure.sha512("whatever", 'activation_code_hash')[0, 24]
      expect(ActivationCode.code_hash('whatever')).to eq(hash)

      20.times do |i|
        hash = GoSecure.sha512("whatever#{i}", 'activation_code_hash')[0, 24]
        expect(ActivationCode.code_hash("whatever#{i}")).to eq(hash)
      end
    end
  end

  describe "find_record" do
    it "should find a record for the specified code" do
      u = User.create
      u2 = User.create
      ActivationCode.create(code_hash: GoSecure.sha512('bacon', 'activation_code_hash')[0, 24], record_code: Webhook.get_record_code(u))
      ActivationCode.create(code_hash: GoSecure.sha512('cheese', 'activation_code_hash')[0, 24], record_code: Webhook.get_record_code(u))
      ActivationCode.create(code_hash: 'blah', record_code: Webhook.get_record_code(u))
      ActivationCode.create(code_hash: GoSecure.sha512('radish', 'activation_code_hash')[0, 24], record_code: Webhook.get_record_code(u2))
      u2.destroy
      expect(ActivationCode.find_record('bacon')).to eq(u)
      expect(ActivationCode.find_record('cheese')).to eq(u)
      expect(ActivationCode.find_record('blah')).to eq(nil)
      expect(ActivationCode.find_record('radish')).to eq(nil)
    end
  end

  describe "generate" do
    it "should return false if code already in use" do
      u = User.create
      u2 = User.create
      ActivationCode.create(code_hash: GoSecure.sha512('bacon', 'activation_code_hash')[0, 24], record_code: Webhook.get_record_code(u))
      expect(ActivationCode.generate('bacon', u)).to eq(false)
      expect(ActivationCode.generate('bacon', u2)).to eq(false)
      expect(ActivationCode.generate('bracon', u2)).to_not eq(false)
    end

    it "should generate a activation and return the id" do
      u = User.create
      id = ActivationCode.generate('bacon', u)
      expect(id).to_not eq(false)
      ac = ActivationCode.find_by(id: id)
      expect(ac).to_not eq(nil)
      expect(ac.record_code).to eq(Webhook.get_record_code(u))
      expect(ac.code_hash).to eq(GoSecure.sha512('bacon', 'activation_code_hash')[0, 24])

      id = ActivationCode.generate('bracon', u)
      expect(id).to_not eq(false)
      ac = ActivationCode.find_by(id: id)
      expect(ac).to_not eq(nil)
      expect(ac.record_code).to eq(Webhook.get_record_code(u))
      expect(ac.code_hash).to eq(GoSecure.sha512('bracon', 'activation_code_hash')[0, 24])

      id = ActivationCode.generate('bacon', u)
      expect(id).to eq(false)
    end
  end
end
