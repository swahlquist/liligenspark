require 'spec_helper'

describe Api::WordsController, :type => :controller do
  describe "reachable_core" do
    it "should not require an api token" do
      get 'reachable_core', {params: {'user_id' => 'aaa', 'utterance_id' => 'qqq'}}
      assert_not_found('aaa')
    end

    it "should require a valid user" do
      get 'reachable_core', {params: {'user_id' => 'aaa', 'utterance_id' => 'qqq'}}
      assert_not_found('aaa')
    end

    it "should allow supervisor access" do
      token_user
      u = User.create
      User.link_supervisor_to_user(@user, u)
      expect(WordData).to receive(:reachable_core_list_for).with(u).and_return({a: 1})
      get 'reachable_core', {params: {'user_id' => u.global_id}}
      json = assert_success_json
      expect(json).to eq({'words' => {'a' => 1}})
    end

    it "should error with neither supervisor nor utterance_core_access" do
      u = User.create
      u.settings['preferences']['utterance_core_access'] = false
      u.save
      get 'reachable_core', {params: {'user_id' => u.global_id, 'utterance_id' => 'qqq'}}
      assert_unauthorized
    end

    it "should error without valid utterance" do
      u = User.create
      get 'reachable_core', {params: {'user_id' => u.global_id, 'utterance_id' => 'qqq'}}
      assert_not_found('qqq')
    end

    it "should error without valid reply code" do
      u = User.create
      utt = Utterance.create(user: u)
      get 'reachable_core', {params: {'user_id' => u.global_id, 'utterance_id' => "#{utt.global_id}x000"}}
      assert_unauthorized
    end

    it "should error without valid reply code" do
      u = User.create
      utt = Utterance.create(user: u)
      expect(WordData).to receive(:reachable_core_list_for).with(u).and_return({a: 1})
      get 'reachable_core', {params: {'user_id' => u.global_id, 'utterance_id' => "#{utt.global_id}x#{utt.reply_nonce}ZA"}}
      json = assert_success_json
      expect(json).to eq({'words' => {'a' => 1}})
    end
  end
end
