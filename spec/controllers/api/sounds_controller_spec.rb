require 'spec_helper'

describe Api::SoundsController, :type => :controller do
  describe "create" do
    it "should require api token" do
      post :create, params: {}
      assert_missing_token
    end
    
    it "should create a sound based on the passer parameters" do
      token_user
      url = "https://#{ENV['UPLOADS_S3_BUCKET']}.s3.amazonaws.com/bacon.mp3"
      post :create, params: {:sound => {'url' => url, 'content_type' => 'audio/mp3'}}
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['sound']['id']).not_to eq(nil)
      expect(json['sound']['url']).to eq(url)
      expect(json['meta']).to eq(nil)
    end
    
    it "should return meta (upload information) for pending sounds" do
      token_user
      url = "https://www.example.com/pic.mp3"
      post :create, params: {:sound => {'url' => url, 'content_type' => 'audio/mp3'}}
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['sound']['id']).not_to eq(nil)
      expect(json['sound']['pending']).to eq(true)
      expect(json['sound']['url']).to eq(nil)
      expect(json['meta']).not_to eq(nil)
    end
    
    it "should error gracefully on sound create fail" do
      token_user
      url = "https://www.example.com/pic.mp3"
      expect_any_instance_of(ButtonSound).to receive(:process_params){|u| u.add_processing_error("bacon") }.and_return(false)
      post :create, params: {:sound => {'url' => url, 'content_type' => 'audio/mp3'}}
      expect(response).not_to be_success
      json = JSON.parse(response.body)
      expect(json['error']).to eq("sound creation failed")
      expect(json['errors']).to eq(["bacon"])
    end
  end
  
  describe "upload_success" do
    it "should not require api token" do
      get :upload_success, params: {:sound_id => "1234"}
      expect(response).not_to be_success
      json = JSON.parse(response.body)
      expect(json).to eq({'confirmed' => false, 'message' => 'Invalid confirmation key'})
    end
    
    it "should error for bad confirmation key" do
      get :upload_success, params: {:sound_id => "1234"}
      expect(response).not_to be_success
      json = JSON.parse(response.body)
      expect(json).to eq({'confirmed' => false, 'message' => 'Invalid confirmation key'})
    end
    
    it "should error for valid confirmation key but missing from server" do
      s = ButtonSound.create(:settings => {'content_type' => 'audio/mp3'})
      config = Uploader.remote_upload_config
      res = OpenStruct.new(:success? => false)
      expect(Typhoeus).to receive(:head).with(config[:upload_url] + s.full_filename).and_return(res)
      get :upload_success, params: {:sound_id => s.global_id, :confirmation => s.confirmation_key}
      expect(response).not_to be_success
      json = JSON.parse(response.body)
      expect(json).to eq({'confirmed' => false, 'message' => 'File not found'})
    end
    
    it "should succeed for valid confirmation key that is found on server" do
      s = ButtonSound.create(:settings => {'content_type' => 'audio/mp3'})
      config = Uploader.remote_upload_config
      res = OpenStruct.new(:success? => true)
      expect(Typhoeus).to receive(:head).with(config[:upload_url] + s.full_filename).and_return(res)
      get :upload_success, params: {:sound_id => s.global_id, :confirmation => s.confirmation_key}
      json = JSON.parse(response.body)
      expect(response).to be_success
      expect(s.reload.url).not_to eq(nil)
      expect(s.settings['pending']).to eq(false)
      expect(json).to eq({'confirmed' => true, 'url' => s.url})
    end
  end
  
  describe "show" do
    it "should require api token" do
      get :show, params: {:id => 1}
      assert_missing_token
    end
    
    it "should error on not found" do
      token_user
      get :show, params: {:id => '1234'}
      assert_not_found
    end
    
    it "should return a found object" do
      token_user
      s = ButtonSound.create(:settings => {'content_type' => 'audio/mp3'})
      get :show, params: {:id => s.global_id}
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['sound']['id']).to eq(s.global_id)
      expect(json['sound']['content_type']).to eq('audio/mp3')
    end
  end
  
  describe "update" do
    it "should require api token" do
      put :update, params: {:id => "1234"}
      assert_missing_token
    end
    
    it "should error on not found" do
      token_user
      put :update, params: {:id => "1234"}
      assert_not_found
    end
    
    it "should update an object" do
      token_user
      s = ButtonSound.create(:user => @user, :settings => {'content_type' => 'audio/mp3'})
      put :update, params: {:id => s.global_id, :sound => {:license => {'type' => 'CC-By'}}}
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['sound']['id']).to eq(s.global_id)
      expect(json['sound']['license']).to eq({'type' => 'CC-By'})
    end
    
    it "should error gracefully on sound update fail" do
      expect_any_instance_of(ButtonSound).to receive(:process_params){|u| u.add_processing_error("bacon") }.and_return(false)
      token_user
      s = ButtonSound.create(:user => @user, :settings => {'content_type' => 'audio/mp3'})
      put :update, params: {:id => s.global_id, :sound => {:license => {'type' => 'CC-By'}}}
      expect(response).not_to be_success
      json = JSON.parse(response.body)
      expect(json['error']).to eq("sound update failed")
      expect(json['errors']).to eq(["bacon"])
    end
  end
end
