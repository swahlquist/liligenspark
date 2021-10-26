require 'spec_helper'

describe Api::ProfilesController, :type => :controller do
  describe "show" do
    it "should require an access token" do
      get 'show', params: {id: 'asdf'}
      assert_missing_token
    end

    it "should require a valid record" do
      token_user
      get 'show', params: {id: 'asdf'}
      assert_not_found('asdf')
    end

    it "should require authorization" do
      token_user
      template = ProfileTemplate.create
      get 'show', params: {id: template.global_id}
      assert_unauthorized
    end

    it "should return a template from the db" do
      token_user
      template = ProfileTemplate.create(user: @user)
      get 'show', params: {id: template.global_id}
      json = assert_success_json
      expect(json['profile']['id']).to eq(template.global_id)
    end

    it "should return a hard-coded template" do
      token_user
      template = ProfileTemplate.create(user: @user)
      get 'show', params: {id: 'cole'}
      json = assert_success_json
      expect(json['profile']['profile_id']).to eq('cole')
      expect(json['profile']['id']).to eq('cole')
    end
  end


  describe "latest" do
    it "should require an access token" do
      get 'latest'
      assert_missing_token
    end

    it "should require a valid user" do
      token_user
      get 'latest', params: {user_id: 'asdf'}
      assert_not_found('asdf')
    end

    it "should require authorization on the user" do
      token_user
      u = User.create
      get 'latest', params: {user_id: u.global_id}
      assert_unauthorized
    end

    it "should return a list of profile results" do
      token_user
      s1 = LogSession.create(user: @user, author: @user, device: @device, data: {'profile' => {'id' => 'bacon', 'started' => 6.weeks.ago.to_i}})
      s2 = LogSession.create(user: @user, author: @user, device: @device, data: {'profile' => {'id' => 'bacon2', 'started' => 3.weeks.ago.to_i}})
      get 'latest', params: {user_id: @user.global_id}
      json = assert_success_json
      expect(json.length).to eq(2)
      expect(json.map{|r| r['log_id']}).to eq([s2.global_id, s1.global_id])
      expect(json.map{|r| r['profile']['id'] }).to eq(['bacon2', 'bacon'])
    end

    it "should return only results for a specific profile_id if specified" do
      token_user
      s1 = LogSession.create(user: @user, author: @user, device: @device, data: {'profile' => {'id' => 'bacon', 'started' => 6.weeks.ago.to_i}})
      s2 = LogSession.create(user: @user, author: @user, device: @device, data: {'profile' => {'id' => 'bacon2', 'started' => 3.weeks.ago.to_i}})
      get 'latest', params: {user_id: @user.global_id, profile_id: 'bacon'}
      json = assert_success_json
      expect(json.length).to eq(1)
      expect(json.map{|r| r['log_id']}).to eq([s1.global_id])
      expect(json.map{|r| r['profile']['id'] }).to eq(['bacon'])
    end

    it "should include org-defined profiles if specified" do
      token_user
      org = Organization.create(settings: {'total_licenses' => 2})
      org.add_user(@user.user_name, false)
      org.add_supervisor(@user.user_name, false)
      t1 = ProfileTemplate.create(public_profile_id: 'cheese', settings: {'public' => true, 'profile' => {'name' => 'Cheese'}})
      org.settings['communicator_profile'] = {
        'profile_id' => 'cole'
      }
      org.settings['supervisor_profile'] = {
        'profile_id' => 'cheese',
        'template_id' => t1.global_id
      }
      org.save
      s1 = LogSession.create(user: @user, author: @user, device: @device, data: {'profile' => {'id' => 'bacon', 'started' => 6.weeks.ago.to_i}})
      s2 = LogSession.create(user: @user, author: @user, device: @device, data: {'profile' => {'id' => 'bacon2', 'started' => 3.weeks.ago.to_i}})
      get 'latest', params: {user_id: @user.global_id, include_suggestions: '1'}
      json = assert_success_json
      expect(json.length).to eq(4)
      expect(json.map{|r| r['log_id']}).to eq([s2.global_id, s1.global_id, nil, nil])
      expect(json.map{|r| r['profile']['id'] }).to eq(['bacon2', 'bacon', 'cole', 'cheese'])
    end

    it "should not include suggestions if results exists for a profile_id" do
      token_user
      org = Organization.create(settings: {'total_licenses' => 2})
      org.add_user(@user.user_name, false)
      org.add_supervisor(@user.user_name, false)
      t1 = ProfileTemplate.create(public_profile_id: 'cheese', settings: {'public' => true, 'profile' => {'name' => 'Cheese'}})
      org.settings['communicator_profile'] = {
        'profile_id' => 'cole',
        'frequency' => 12.months.to_i
      }
      org.settings['supervisor_profile'] = {
        'profile_id' => 'cheese',
        'template_id' => t1.global_id
      }
      org.save
      s1 = LogSession.create(user: @user, author: @user, device: @device, data: {'profile' => {'id' => 'cole', 'started' => 18.month.ago.to_i}})
      s2 = LogSession.create(user: @user, author: @user, device: @device, data: {'profile' => {'id' => 'cheese', 'started' => 3.weeks.ago.to_i}})
      get 'latest', params: {user_id: @user.global_id, include_suggestions: '1'}
      json = assert_success_json
      expect(json.length).to eq(2)
      expect(json.map{|r| r['log_id']}).to eq([s2.global_id, s1.global_id])
      expect(json.map{|r| r['profile']['id'] }).to eq(['cheese', 'cole'])
      expect(json[0]['expected']).to eq(nil)
      expect(json[1]['expected']).to eq('overdue')
    end

    it "should specify whether profile results are due for a repeat" do
      token_user
      org = Organization.create(settings: {'total_licenses' => 2})
      org.add_user(@user.user_name, false)
      org.add_supervisor(@user.user_name, false)
      t1 = ProfileTemplate.create(public_profile_id: 'cheese', settings: {'public' => true, 'profile' => {'name' => 'Cheese'}})
      org.settings['communicator_profile'] = {
        'profile_id' => 'cole',
        'frequency' => 12.months.to_i
      }
      org.settings['supervisor_profile'] = {
        'profile_id' => 'cheese',
        'template_id' => t1.global_id
      }
      org.save
      s1 = LogSession.create(user: @user, author: @user, device: @device, data: {'profile' => {'id' => 'cole', 'started' => 18.month.ago.to_i}})
      s2 = LogSession.create(user: @user, author: @user, device: @device, data: {'profile' => {'id' => 'cheese', 'started' => 3.weeks.ago.to_i}})
      get 'latest', params: {user_id: @user.global_id, include_suggestions: '1'}
      json = assert_success_json
      expect(json.length).to eq(2)
      expect(json.map{|r| r['log_id']}).to eq([s2.global_id, s1.global_id])
      expect(json.map{|r| r['profile']['id'] }).to eq(['cheese', 'cole'])
      expect(json[0]['expected']).to eq(nil)
      expect(json[1]['expected']).to eq('overdue')
    end
  end
end
