require 'spec_helper'

describe Api::WebhooksController, :type => :controller do
  describe "get 'index'" do
    it "should require an api token" do
      get 'index', params: {'user_id' => 'asdf'}
      assert_missing_token
    end
    
    it "should error if the user doesn't exist" do
      token_user
      get 'index', params: {'user_id' => 'asdf'}
      assert_not_found('asdf')
    end
    
    it "should error if not authorized" do
      token_user
      u = User.create
      get 'index', params: {'user_id' => u.global_id}
      assert_unauthorized
    end
    
    it "should return a paginated list" do
      token_user
      w = Webhook.create(:user_id => @user.id)
      get 'index', params: {'user_id' => @user.global_id}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json).to_not eq(nil)
      expect(json['webhook']).to_not eq(nil)
      expect(json['webhook'].length).to eq(1)
      expect(json['webhook'][0]['id']).to eq(w.global_id)
      expect(json['meta']).to_not eq(nil)
    end
  end
  
  describe "post 'create'" do
    it "should require an api token" do
      post 'create', params: {'webhook' => {'user_id' => 'asdf'}}
      assert_missing_token
    end
    
    it "should error if the user doesn't exist" do
      token_user
      post 'create', params: {'webhook' => {'user_id' => 'asdf'}}
      assert_not_found('asdf')
    end
    
    it "should require authorization" do
      token_user
      u = User.create
      post 'create', params: {'webhook' => {'user_id' => u.global_id}}
      assert_unauthorized
    end
    
    it "should create the webhook" do
      token_user
      post 'create', params: {'webhook' => {'user_id' => @user.global_id, 'name' => 'test webhook'}}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json).to_not eq(nil)
      expect(json['webhook']).to_not eq(nil)
      expect(json['webhook']['id']).to_not eq(nil)
      expect(json['webhook']['name']).to eq('test webhook')
    end
  end
  
  describe "post 'test'" do
    it "should require an api token" do
      post 'test', params: {'webhook_id' => 'asdf'}
      assert_missing_token
    end
    
    it "should error if the webhook doesn't exist" do
      token_user
      post 'test', params: {'webhook_id' => 'asdf'}
      assert_not_found('asdf')
    end
    
    it "should require authorization" do
      token_user
      u = User.create
      webhook = Webhook.create(:user_id => u.id)
      post 'test', params: {'webhook_id' => webhook.global_id}
      assert_unauthorized
    end
    
    it "should schedule the test" do
      token_user
      webhook = Webhook.create(:user_id => @user.id)
      post 'test', params: {'webhook_id' => webhook.global_id}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['progress']).to_not eq(nil)
      progress = Progress.find_by_path(json['progress']['id'])
      expect(Worker.scheduled_for?('priority', Progress, 'perform_action', progress.id)).to eq(true)
      expect(progress.settings['class']).to eq('Webhook')
      expect(progress.settings['method']).to eq('test_notification')
      expect(progress.settings['id']).to eq(webhook.id)
    end
    
    it "should return a progress record" do
      token_user
      webhook = Webhook.create(:user_id => @user.id)
      post 'test', params: {'webhook_id' => webhook.global_id}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json).to_not eq(nil)
      expect(json['webhook']).to eq(nil)
      expect(json['progress']).to_not eq(nil)
    end
  end
  
  describe "put 'update'" do
    it "should require an api token" do
      put 'update', params: {'id' => 'asdf'}
      assert_missing_token
    end
    
    it "should error if the record doesn't exist" do
      token_user
      put 'update', params: {'id' => 'asdf'}
      assert_not_found('asdf')
    end
    
    it "should require authorization" do
      token_user
      u = User.create
      w = Webhook.create(:user_id => u.id)
      put 'update', params: {'id' => w.global_id}
      assert_unauthorized
    end
    
    it "should update the record" do
      token_user
      w = Webhook.create(:user_id => @user.id)
      put 'update', params: {'id' => w.global_id, 'webhook' => {'name' => 'new name'}}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json).to_not eq(nil)
      expect(json['webhook']['id']).to eq(w.global_id)
      expect(json['webhook']['name']).to eq('new name')
    end
  end
  
  describe "delete 'destroy'" do
    it "should require an api token" do
      delete 'destroy', params: {'id' => 'asdf'}
      assert_missing_token
    end
    
    it "should error if the record doesn't exist" do
      token_user
      delete 'destroy', params: {'id' => 'asdf'}
      assert_not_found('asdf')
    end
    
    it "should require authorization" do
      token_user
      u = User.create
      w = Webhook.create(:user_id => u.id)
      delete 'destroy', params: {'id' => w.global_id}
      assert_unauthorized
    end
    
    it "should delete the record" do
      token_user
      w = Webhook.create(:user_id => @user.id)
      delete 'destroy', params: {'id' => w.global_id}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json).to_not eq(nil)
      expect(json['webhook']['id']).to eq(w.global_id)
    end
  end
end
