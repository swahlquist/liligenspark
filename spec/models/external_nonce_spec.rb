require 'spec_helper'

describe ExternalNonce, :type => :model do
  describe "generate_defaults" do
    it "should generate default values" do
      n = ExternalNonce.create
      expect(n.purpose).to eq('unknown')
      expect(n.transform).to eq('sha512')
      expect(n.nonce).to_not eq(nil)
      expect(n.uses).to eq(0)

      n = ExternalNonce.create(purpose: 'a', transform: 'b', uses: 3)
      expect(n.purpose).to eq('a')
      expect(n.transform).to eq('b')
      expect(n.nonce).to_not eq(nil)
      expect(n.uses).to eq(3)
    end
  end

  describe "encryption_key" do
    it "should return split values" do
      n = ExternalNonce.create
      expect(n.encryption_key).to eq(n.encryption_key)
      sha = GoSecure.sha512(n.nonce, ENV['SECURE_NONCE_KEY'])
      expect(n.encryption_key).to eq([sha[0, 32], sha[32..-1]])
    end
  end

  describe "track_usage!" do
    it "should update found nonce" do
      n = ExternalNonce.create
      expect(ExternalNonce.track_usage!(n.global_id)).to eq(true)
      expect(n.reload.uses).to eq(1)
      expect(ExternalNonce.track_usage!('cheese!')).to eq(false)
      expect(n.reload.uses).to eq(1)
      expect(ExternalNonce.track_usage!(n.global_id)).to eq(true)
      expect(n.reload.uses).to eq(2)
    end
  end

  describe "encryption_result" do
    it "should return encryption data" do
      n = ExternalNonce.create
      expect(n.encryption_result).to eq({
        id: n.global_id,
        key: n.encryption_key[0],
        extra: n.encryption_key[1]
      })
    end
  end

  describe "for_user" do
    it "should generate a new nonce for the user and return the encryption data" do
      u = User.create
      res = ExternalNonce.for_user(u)
      expect(res).to_not eq(nil)
      expect(res[:id]).to_not eq(nil)
      expect(res[:key]).to_not eq(nil)
      expect(res[:extra]).to_not eq(nil)
    end

    it "should find an existing nonce that hasn't expired" do
      u = User.create
      res = ExternalNonce.for_user(u)
      expect(res).to_not eq(nil)
      expect(res[:id]).to_not eq(nil)
      expect(res[:key]).to_not eq(nil)
      expect(res[:extra]).to_not eq(nil)
      expect(u.settings['external_nonce']).to_not eq(nil)

      res2 = ExternalNonce.for_user(u)
      expect(res2).to_not eq(nil)
      expect(res2[:id]).to eq(res[:id])
      expect(res2[:key]).to eq(res[:key])
      expect(res2[:extra]).to eq(res[:extra])
    end

    it "should generate a new nonce when the old one has expired" do
      u = User.create
      res = ExternalNonce.for_user(u)
      expect(res).to_not eq(nil)
      expect(res[:id]).to_not eq(nil)
      expect(res[:key]).to_not eq(nil)
      expect(res[:extra]).to_not eq(nil)
      u.settings['external_nonce']['expires'] = 5.seconds.ago.to_i

      res2 = ExternalNonce.for_user(u)
      expect(res2).to_not eq(nil)
      expect(res2[:id]).to_not eq(res[:id])
      expect(res2[:key]).to_not eq(res[:key])
      expect(res2[:extra]).to_not eq(res[:extra])
    end

    it "should generate a new nonce when the old one has been used too much" do
      u = User.create
      res = ExternalNonce.for_user(u)
      expect(res).to_not eq(nil)
      expect(res[:id]).to_not eq(nil)
      expect(res[:key]).to_not eq(nil)
      expect(res[:extra]).to_not eq(nil)
      u.settings['external_nonce']['expires'] = 5.seconds.ago.to_i
      10.times do 
        ExternalNonce.track_usage!(res[:id])
      end

      res2 = ExternalNonce.for_user(u)
      expect(res2).to_not eq(nil)
      expect(res2[:id]).to_not eq(res[:id])
      expect(res2[:key]).to_not eq(res[:key])
      expect(res2[:extra]).to_not eq(res[:extra])
    end
  end

  describe "generate" do
    it "should generate a new record" do
      n = ExternalNonce.generate('bacon')
      expect(n).to_not eq(nil)
      expect(n.nonce).to_not eq(nil)
      expect(n.purpose).to eq('bacon')
    end
  end

  describe "init_client_encryption" do
    it "should generate unique values" do
      a = ExternalNonce.init_client_encryption
      b = ExternalNonce.init_client_encryption
      expect(a['iv']).to_not eq(nil)
      expect(a['key']).to_not eq(nil)
      expect(a['hash']).to_not eq(nil)
      expect(a['iv']).to_not eq(b['iv'])
      expect(a['key']).to_not eq(b['key'])
      expect(a['hash']).to_not eq(b['hash'])
    end
  end

  describe "client_encrypt" do
    it "should encrypt correctly" do
      opts = {"iv"=>"jMR4YipAatblyqLN", "key"=>"d1115d86cfdb3cd53706d3dec7132159", "hash"=>"5515fff302e6093a"}
      expect(ExternalNonce.client_encrypt([], opts)).to eq("aes256-rmHzDC5Uw+gwptw2fwOv8Wo2\n")
      expect(ExternalNonce.client_encrypt({a: 1}, opts)).to eq("aes256-jh56kAqUf7dnmkAwLlEGzfKhFVIAogc=\n")
    end
  end

  describe "client_decrypt" do
    it "should decrypt correctly" do
      opts = {"iv"=>"jMR4YipAatblyqLN", "key"=>"d1115d86cfdb3cd53706d3dec7132159", "hash"=>"5515fff302e6093a"}
      expect(ExternalNonce.client_decrypt("aes256-rmHzDC5Uw+gwptw2fwOv8Wo2\n", opts)).to eq([])
      expect(ExternalNonce.client_decrypt("aes256-jh56kAqUf7dnmkAwLlEGzfKhFVIAogc=\n", opts)).to eq({'a' => 1})

      opts = ExternalNonce.init_client_encryption
      expect(ExternalNonce.client_decrypt(ExternalNonce.client_encrypt({a: 1}, opts), opts)).to eq({'a' => 1})
      expect(ExternalNonce.client_decrypt(ExternalNonce.client_encrypt("super sekrit informayshun", opts), opts)).to eq("super sekrit informayshun")
    end
  end
end
