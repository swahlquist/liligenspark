require 'spec_helper'

describe JsonApi::Profile do
  it "should have defined pagination defaults" do
    expect(JsonApi::Profile::TYPE_KEY).to eq('profile')
    expect(JsonApi::Profile::DEFAULT_PAGE).to eq(25)
    expect(JsonApi::Profile::MAX_PAGE).to eq(50)
  end

  describe "build_json" do
    it "should include basic template information" do
      u = User.create
      t = ProfileTemplate.create(public_profile_id: 'aaa', user: u, settings: {'public' => 'unlisted', 'profile' => {'name' => 'Bob'}})
      json = JsonApi::Profile.build_json(t, permissions: u)
      expect(json['id']).to eq(t.global_id)
      expect(json['profile_id']).to eq('aaa')
      expect(json['public']).to eq('unlisted')
      expect(json['template']).to eq({'name' => 'Bob', 'template_id' => t.global_id, 'id' => 'aaa'})
    end
  end
end
