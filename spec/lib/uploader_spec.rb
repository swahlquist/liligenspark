require 'spec_helper'

describe Uploader do
  describe "remote_upload" do
    it "should request upload parameters" do
      expect(Uploader).to receive(:remote_upload_params).with("bacon", "hat/beret").and_return({})
      Uploader.remote_upload("bacon", "/hat", "hat/beret")
    end
    it "should fail gracefully if the file is not found" do
      expect(Uploader.remote_upload("bacon", "/hat", "hat/beret")).to eq(nil)
    end
    
    it "should post the upload, including a file handle" do
      expect(Uploader).to receive(:remote_upload_params).with("bacon", "text/plaintext").and_return({
        :upload_params => {:a => 1, :b => 2},
        :upload_url => "http://www.upload.com/"
      })
      res = OpenStruct.new(:success? => true)
      f = Tempfile.new("stash")
      expect(Typhoeus).to receive(:post) { |url, args|
        expect(url).to eq("http://www.upload.com/")
        expect(args[:body][:a]).to eq(1)
        expect(args[:body][:b]).to eq(2)
        expect(args[:body][:file].path).to eq(f.path)
      }.and_return(res)
      Uploader.remote_upload("bacon", f.path, "text/plaintext")
      f.unlink
    end
    
    it "should return the url to the uploaded object if successful" do
      expect(Uploader).to receive(:remote_upload_params).with("bacon", "text/plaintext").and_return({
        :upload_params => {:a => 1, :b => 2},
        :upload_url => "http://www.upload.com/"
      })
      res = OpenStruct.new(:success? => true)
      f = Tempfile.new("stash")
      expect(Typhoeus).to receive(:post).and_return(res)
      expect(Uploader.remote_upload("bacon", f.path, "text/plaintext")).to eq("http://www.upload.com/bacon")
      f.unlink
    end
    it "should return nil if upload unsuccessful" do
      expect(Uploader).to receive(:remote_upload_params).with("bacon", "text/plaintext").and_return({
        :upload_params => {:a => 1, :b => 2},
        :upload_url => "http://www.upload.com/"
      })
      res = OpenStruct.new(:success? => false)
      f = Tempfile.new("stash")
      expect(Typhoeus).to receive(:post).and_return(res)
      expect(Uploader.remote_upload("bacon", f.path, "text/plaintext")).to eq(nil)
      f.unlink
    end
  end

  describe "check_existing_upload" do
    it "should do something work speccing"
  end  

  describe "remote_upload_params" do
    it "should generate signed upload parameters" do
      res = Uploader.remote_upload_params("downloads/file.png", "image/png")
      expect(res[:upload_url]).to eq(Uploader.remote_upload_config[:upload_url])
      expect(res[:upload_params]).not_to eq(nil)
      expect(res[:upload_params]['AWSAccessKeyId']).not_to eq(nil)
      expect(res[:upload_params]['Content-Type']).to eq('image/png')
      expect(res[:upload_params]['acl']).to eq('public-read')
      expect(res[:upload_params]['key']).to eq('downloads/file.png')
      expect(res[:upload_params]['policy']).not_to eq(nil)
      expect(res[:upload_params]['signature']).not_to eq(nil)
      expect(res[:upload_params]['success_action_status']).to eq('200')
    end
  end

  describe "remote_upload_config" do
    it "should return data from environment variables" do
      Uploader.instance_variable_set('@remote_upload_config', nil)
      expect(Uploader.remote_upload_config).to eq({
        :upload_url => "https://#{ENV['UPLOADS_S3_BUCKET']}.s3.amazonaws.com/",
        :access_key => ENV['AWS_KEY'],
        :secret => ENV['AWS_SECRET'],
        :bucket_name => ENV['UPLOADS_S3_BUCKET'],
        :static_bucket_name => ENV['STATIC_S3_BUCKET']
      })
    end
  end
  
  describe "signed_download_url" do
    it "should return a signed url if the object is found" do
      object = OpenStruct.new(:temporary_url => "asdfjkl")
      objects = OpenStruct.new
      expect(objects).to receive(:find).with('asdf').and_return(object)
      bucket = OpenStruct.new(:objects => objects)
      buckets = OpenStruct.new
      expect(buckets).to receive(:find).with(ENV['STATIC_S3_BUCKET']).and_return(bucket)
      service = OpenStruct.new(:buckets => buckets)
      expect(S3::Service).to receive(:new).and_return(service)
      
      expect(Uploader.signed_download_url("asdf")).to eq("asdfjkl")
    end
    
    it "should return nil if an object is not found" do
      objects = OpenStruct.new
      expect(objects).to receive(:find).with('asdf').and_return(nil)
      bucket = OpenStruct.new(:objects => objects)
      buckets = OpenStruct.new
      expect(buckets).to receive(:find).with(ENV['STATIC_S3_BUCKET']).and_return(bucket)
      service = OpenStruct.new(:buckets => buckets)
      expect(S3::Service).to receive(:new).and_return(service)
      
      expect(Uploader.signed_download_url("asdf")).to eq(nil)
    end
    
    it "should return nil if the bucket is not found" do
      buckets = OpenStruct.new
      expect(buckets).to receive(:find).with(ENV['STATIC_S3_BUCKET']).and_return(nil)
      service = OpenStruct.new(:buckets => buckets)
      expect(S3::Service).to receive(:new).and_return(service)
      
      expect(Uploader.signed_download_url("asdf")).to eq(nil)
    end
    
    it "should filter out the bucket host and protocol" do
      object = OpenStruct.new(:temporary_url => "asdfjkl")
      objects = OpenStruct.new
      expect(objects).to receive(:find).with('asdf').and_return(object).exactly(3).times
      bucket = OpenStruct.new(:objects => objects)
      buckets = OpenStruct.new
      expect(buckets).to receive(:find).with(ENV['STATIC_S3_BUCKET']).and_return(bucket).exactly(3).times
      service = OpenStruct.new(:buckets => buckets)
      expect(S3::Service).to receive(:new).and_return(service).exactly(3).times
      
      expect(Uploader.signed_download_url("asdf")).to eq("asdfjkl")
      expect(Uploader.signed_download_url("https://#{ENV['STATIC_S3_BUCKET']}.s3.amazonaws.com/asdf")).to eq("asdfjkl")
      expect(Uploader.signed_download_url("https://s3.amazonaws.com/#{ENV['STATIC_S3_BUCKET']}/asdf")).to eq("asdfjkl")
    end
  end

  describe "valid_remote_url?" do
    it "should return true only for known URLs" do
      expect(Uploader.valid_remote_url?("https://#{ENV['UPLOADS_S3_BUCKET']}.s3.amazonaws.com/bacon")).to eq(true)
      expect(Uploader.valid_remote_url?("http://#{ENV['UPLOADS_S3_BUCKET']}.s3.amazonaws.com/bacon")).to eq(false)
      expect(Uploader.valid_remote_url?("https://#{ENV['UPLOADS_S3_BUCKET']}.s3.amazonaws.com/bacon/downloads/maple.zip")).to eq(true)
      expect(Uploader.valid_remote_url?("https://s3.amazonaws.com/#{ENV['OPENSYMBOLS_S3_BUCKET']}/hat.png")).to eq(true)
      expect(Uploader.valid_remote_url?("http://s3.amazonaws.com/#{ENV['OPENSYMBOLS_S3_BUCKET']}/hat.png")).to eq(false)
      expect(Uploader.valid_remote_url?("https://s3.amazonaws.com/#{ENV['OPENSYMBOLS_S3_BUCKET']}2/hat.png")).to eq(false)
      expect(Uploader.valid_remote_url?("https://images.com/cow.png")).to eq(false)
    end
  end  
  
  describe "remote_remove" do
    it "should raise error on unexpected path" do
      expect{ Uploader.remote_remove("https://www.google.com/bacon") }.to raise_error("scary delete, not a path I'm comfortable deleting...")
      expect{ Uploader.remote_remove("https://s3.amazonaws.com/#{ENV['UPLOADS_S3_BUCKET']}/images/abcdefg/asdf/asdfasdf.asdf") }.to raise_error("scary delete, not a path I'm comfortable deleting...")
    end
    
    it "should remove the object if found" do
      object = OpenStruct.new
      expect(object).to receive(:destroy).and_return(true)
      objects = OpenStruct.new
      expect(objects).to receive(:find).with('images/abcdefg/asdf-asdf.asdf').and_return(object)
      bucket = OpenStruct.new({
        objects: objects
      })
      buckets = OpenStruct.new
      expect(buckets).to receive(:find).and_return(bucket)
      service = OpenStruct.new({
        buckets: buckets
      })
      expect(S3::Service).to receive(:new).and_return(service)
      res = Uploader.remote_remove("https://s3.amazonaws.com/#{ENV['UPLOADS_S3_BUCKET']}/images/abcdefg/asdf-asdf.asdf")
      expect(res).to eq(true)
    end
    
    it "should not error if the object is not found" do
      objects = OpenStruct.new
      expect(objects).to receive(:find).with('images/abcdefg/asdf-asdf.asdf').and_raise("not found")
      bucket = OpenStruct.new({
        objects: objects
      })
      buckets = OpenStruct.new
      expect(buckets).to receive(:find).and_return(bucket)
      service = OpenStruct.new({
        buckets: buckets
      })
      expect(S3::Service).to receive(:new).and_return(service)
      res = Uploader.remote_remove("https://s3.amazonaws.com/#{ENV['UPLOADS_S3_BUCKET']}/images/abcdefg/asdf-asdf.asdf")
      expect(res).to eq(nil)
    end
    
  end
  
  describe 'find_image' do
    it 'should return nothing for unknown libraries' do
      expect(Uploader.find_image('bacon', 'cool-pics', nil)).to eq(nil)
      expect(Uploader.find_image('bacon', '', nil)).to eq(nil)
      expect(Uploader.find_image('bacon', nil, nil)).to eq(nil)
      expect(Uploader.find_image('bacon', '   ', nil)).to eq(nil)
    end
    
    it 'should return nothing for empty queries' do
      expect(Uploader.find_image(nil, 'arasaac', nil)).to eq(nil)
      expect(Uploader.find_image('', 'arasaac', nil)).to eq(nil)
      expect(Uploader.find_image('    ', 'arasaac', nil)).to eq(nil)
    end
    
    it 'should make a remote request' do
      res = OpenStruct.new(body: [
      ].to_json)
      expect(Typhoeus).to receive(:get).with('https://www.opensymbols.org/api/v1/symbols/search?q=bacon+repo%3Aarasaac', :ssl_verifypeer => false).and_return(res)
      image = Uploader.find_image('bacon', 'arasaac', nil)
      expect(image).to eq(nil)
    end
    
    it 'should parse results' do
      res = OpenStruct.new(body: [
        {
          'image_url' => 'http://www.example.com/pic.png',
          'extension' => 'png',
          'width' => '200',
          'height' => '200',
          'id' => '123',
          'license' => 'public_domain',
          'license_url' => 'http://www.example.com/cc0',
          'source_url' => 'http://www.example.com/pics',
          'author' => 'bob',
          'author_url' => 'http://www.example.com/bob'
        }
      ].to_json)
      expect(Typhoeus).to receive(:get).with('https://www.opensymbols.org/api/v1/symbols/search?q=bacon+repo%3Aarasaac', :ssl_verifypeer => false).and_return(res)
      image = Uploader.find_image('bacon', 'arasaac', nil)
      expect(image).to eq({
        'url' => 'http://www.example.com/pic.png',
        'content_type' => 'image/png',
        'width' => '200',
        'height' => '200',
        'external_id' => '123',
        'public' => true,
        'license' => {
          'type' => 'public_domain',
          'copyright_notice_url' => 'http://www.example.com/cc0',
          'source_url' => 'http://www.example.com/pics',
          'author_name' => 'bob',
          'author_url' => 'http://www.example.com/bob',
          'uneditable' => true
        }
      })
    end
  end
end
