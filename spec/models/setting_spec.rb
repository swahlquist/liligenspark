require 'spec_helper'

describe Setting, :type => :model do
  describe "set" do
    it "should set the value" do
      Setting.set('abc', 'qwe')
      expect(Setting.find_by(:key => 'abc').value).to eq('qwe')
    end
  end
  
  describe "get" do
    it "should return value if found" do
      Setting.create(:key => "abc", :value => "qwe")
      expect(Setting.get('abc')).to eq('qwe')
    end
    
    it "should return nil if not found" do
      expect(Setting.get('abc')).to eq(nil)
    end
  end
  
  describe "blocked emails" do
    it "should remember blocked emails" do
      expect(Setting.get('blocked_emails')).to eq(nil)
      Setting.block_email!('Bob@Yahoo.COM')
      expect(Setting.get('blocked_emails')).to eq({'bob@yahoo.com' => true})
      Setting.block_email!('Sue@Hotmail.com')
      expect(Setting.get('blocked_emails')).to eq({'bob@yahoo.com' => true, 'sue@hotmail.com' => true})
      Setting.block_email!('sue@hotmail.com')
      expect(Setting.get('blocked_emails')).to eq({'bob@yahoo.com' => true, 'sue@hotmail.com' => true})
    end
    
    it "should return correct values for blocked_email?" do
      expect(Setting.blocked_email?('bob@yahoo.com')).to eq(false)
      Setting.block_email!('BOB@yahoo.com')
      expect(Setting.blocked_email?('bob@yahoo.COM')).to eq(true)
      expect(Setting.blocked_email?('bob@yahoo.com')).to eq(true)
      expect(Setting.blocked_email?('suE@hoTmAiL.com')).to eq(false)
      Setting.block_email!('sue@HOTmail.com')
      expect(Setting.blocked_email?('bob@yahoo.COM')).to eq(true)
      expect(Setting.blocked_email?('bob@yahoo.com')).to eq(true)
      expect(Setting.blocked_email?('suE@hoTmAiL.com')).to eq(true)
      expect(Setting.blocked_email?('fido@juno.com')).to eq(false)
    end
    
    it "should return a list of blocked emails" do
      Setting.block_email!('Boy@yahoo.COM')
      Setting.block_email!('afred@example.com')
      expect(Setting.blocked_emails).to eq(['afred@example.com', 'boy@yahoo.com'])
    end
  end
end
