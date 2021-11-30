require 'spec_helper'

describe JsonApi::ButtonSet do
  it "should have defined pagination defaults" do
    expect(JsonApi::ButtonSet::TYPE_KEY).to eq('buttonset')
    expect(JsonApi::ButtonSet::DEFAULT_PAGE).to eq(1)
    expect(JsonApi::ButtonSet::MAX_PAGE).to eq(1)
  end

  describe "build_json" do
    it 'should send encryption settings' do
      bs = BoardDownstreamButtonSet.create
      bs.data['extra_data_encryption'] = ExternalNonce.init_client_encryption
      bs.save
      json = JsonApi::ButtonSet.build_json(bs)
      expect(json.keys).not_to be_include('hat')
      expect(json['encryption_settings']).to eq(bs.data['extra_data_encryption'])
      expect(json['board_ids']).to eq([])
    end
  end
end
