require 'spec_helper'

describe JsonApi::Token do
  describe "as_json" do
    it "should return correct attributes" do
      d = Device.create
      d.generate_token!
      u = User.new(user_name: 'fred')
      hash = JsonApi::Token.as_json(u, d)
      expect(hash.keys.sort).to eq(['access_token', 'anonymized_user_id', 'long_token', 'long_token_set', 'modeling_session', 'scopes', 'token_type', 'user_id', 'user_name'])
      expect(hash['access_token']).to eq(d.tokens[0])
      expect(hash['token_type']).to eq('bearer')
      expect(hash['user_name']).to eq('fred')
    end
    
    it "should include scopes data" do
      d = Device.create
      d.developer_key_id = 1
      d.settings['permission_scopes'] = ['a', 'b']
      d.generate_token!
      u = User.new(user_name: 'fred')
      hash = JsonApi::Token.as_json(u, d)
      expect(hash.keys.sort).to eq(['access_token', 'anonymized_user_id', 'long_token', 'long_token_set', 'modeling_session', 'scopes', 'token_type', 'user_id', 'user_name'])
      expect(hash['access_token']).to eq(d.tokens[0])
      expect(hash['scopes']).to eq(['a', 'b'])
    end

    it "should return an anonymized keyed id that is unique to the developer key tied to the device" do
      d = Device.create
      d.developer_key_id = 14
      u = User.new(user_name: 'fred')
      hash = JsonApi::Token.as_json(u, d)
      expect(hash['anonymized_user_id']).to eq(u.anonymized_identifier('external_for_14'))
    end

    it "should include long_token information" do
      d = Device.create
      u = User.new(user_name: 'fred')
      hash = JsonApi::Token.as_json(u, d)
      expect(hash['long_token']).to eq(nil)
      expect(hash['long_token_set']).to eq(false)

      d.settings['long_token'] = false
      d.settings['long_token_set'] = true
      hash = JsonApi::Token.as_json(u, d)
      expect(hash['long_token']).to eq(false)
      expect(hash['long_token_set']).to eq(true)
      
      d.created_at = Date.parse('Jan 1, 2000')
      d.settings['long_token_set'] = nil
      hash = JsonApi::Token.as_json(u, d)
      expect(hash['long_token']).to eq(false)
      expect(hash['long_token_set']).to eq(true)
    end
  end
end
