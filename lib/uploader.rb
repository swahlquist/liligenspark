require 's3'
module Uploader
  S3_EXPIRATION_TIME=60*60
  CONTENT_LENGTH_RANGE=100.megabytes.to_i
  
  def self.remote_upload(remote_path, local_path, content_type)
    params = remote_upload_params(remote_path, content_type)
    post_params = params[:upload_params]
    return nil unless File.exist?(local_path)
    post_params[:file] = File.open(local_path, 'rb')

    # upload to s3 from tempfile
    res = Typhoeus.post(params[:upload_url], body: post_params)
    if res.success?
      return params[:upload_url] + remote_path
    else
      return nil
    end
  end
  
  def self.check_existing_upload(remote_path)
    return nil
    # TODO: if the path exists and won't expire for at least 48 hours
    # then return the existing record URL
  end

  def self.remote_remove(url)
    remote_path = url.sub(/^https:\/\/#{ENV['UPLOADS_S3_BUCKET']}\.s3\.amazonaws\.com\//, '')
    remote_path = remote_path.sub(/^https:\/\/s3\.amazonaws\.com\/#{ENV['UPLOADS_S3_BUCKET']}\//, '')

    raise "scary delete, not a path I'm comfortable deleting..." unless remote_path.match(/\w+\/.+\/\w+-\w+(\.\w+)?$/)
    config = remote_upload_config
    service = S3::Service.new(:access_key_id => config[:access_key], :secret_access_key => config[:secret])
    bucket = service.buckets.find(config[:bucket_name])
    object = bucket.objects.find(remote_path) rescue nil
    object.destroy if object
  end
  
  def self.signed_download_url(url)
    remote_path = url.sub(/^https:\/\/#{ENV['STATIC_S3_BUCKET']}\.s3\.amazonaws\.com\//, '')
    remote_path = remote_path.sub(/^https:\/\/s3\.amazonaws\.com\/#{ENV['STATIC_S3_BUCKET']}\//, '')

    config = remote_upload_config
    service = S3::Service.new(:access_key_id => config[:access_key], :secret_access_key => config[:secret])
    bucket = service.buckets.find(config[:static_bucket_name])
    object = bucket.objects.find(remote_path) rescue nil
    if object
      object.temporary_url
    else
      nil
    end
  end
  
  def self.remote_upload_params(remote_path, content_type)
    config = remote_upload_config
    
    res = {
      :upload_url => config[:upload_url],
      :upload_params => {
        'AWSAccessKeyId' => config[:access_key]
      }
    }
    
    policy = {
      'expiration' => (S3_EXPIRATION_TIME).seconds.from_now.utc.iso8601,
      'conditions' => [
        {'key' => remote_path},
        {'acl' => 'public-read'},
        ['content-length-range', 1, (CONTENT_LENGTH_RANGE)],
        {'bucket' => config[:bucket_name]},
        {'success_action_status' => '200'},
        {'content-type' => content_type}
      ]
    }
    # TODO: for pdfs, policy['conditions'] << {'content-disposition' => 'inline'}

    policy_encoded = Base64.encode64(policy.to_json).gsub(/\n/, '')
    signature = Base64.encode64(
      OpenSSL::HMAC.digest(
        OpenSSL::Digest.new('sha1'), config[:secret], policy_encoded
      )
    ).gsub(/\n/, '')

    res[:upload_params].merge!({
       'key' => remote_path,
       'acl' => 'public-read',
       'policy' => policy_encoded,
       'signature' => signature,
       'Content-Type' => content_type,
       'success_action_status' => '200'
    })
    res
  end
  
  def self.remote_upload_config
    @remote_upload_config ||= {
      :upload_url => "https://#{ENV['UPLOADS_S3_BUCKET']}.s3.amazonaws.com/",
      :access_key => ENV['AWS_KEY'],
      :secret => ENV['AWS_SECRET'],
      :bucket_name => ENV['UPLOADS_S3_BUCKET'],
      :static_bucket_name => ENV['STATIC_S3_BUCKET']
    }
  end
  
  def self.valid_remote_url?(url)
    # TODO: this means we can never delete files from the bucket... is that ok?
    res = self.removable_remote_url?(url)
    # don't re-download files that have already been downloaded
    res ||= url.match(/^https:\/\/#{ENV['OPENSYMBOLS_S3_BUCKET']}\.s3\.amazonaws\.com\//) if ENV['OPENSYMBOLS_S3_BUCKET']
    res ||= url.match(/^https:\/\/s3\.amazonaws\.com\/#{ENV['OPENSYMBOLS_S3_BUCKET']}\//) if ENV['OPENSYMBOLS_S3_BUCKET']
    !!res
  end
  
  def self.removable_remote_url?(url)
    res = url.match(/^https:\/\/#{ENV['UPLOADS_S3_BUCKET']}\.s3\.amazonaws\.com\//)
    res ||= url.match(/^https:\/\/s3\.amazonaws\.com\/#{ENV['UPLOADS_S3_BUCKET']}\//)
    !!res
  end
  
  def self.lessonpix_credentials(user)
  end
  
  def self.find_images(keyword, library, user)
    return [] if (keyword || '').strip.blank? || (library || '').strip.blank?
    if library == 'ss'
      return []
    elsif library == 'lessonpix'
      cred = lessonpix_credentials(user)
      return [] unless cred
      url = "http://lessonpix.com/api/Search?pid=#{cred['pid']}&username=#{cred['username']}&token=#{cred['token']}&query=#{CGI.escape(keyword)}"
      req = Typhoeus.get(url)
      results = JSON.parse(req.body) rescue nil
      list = []
      results.each do |obj|
        list << {
          'url' => "/api/v1/users/#{user.global_id}/lessonpix/#{obj['id']}",
          'content_type' => 'image/png',
          'width' => 200,
          'height' => 200,
          'external_id' => obj['id'],
          'public' => true,
          'license' => {
            'type' => 'private',
            'source_url' => "http://lessonpix.com/pictures/#{obj['id']}/#{obj['label']}",
            'author_name' => 'LessonPix',
            'author_url' => 'http://lessonpix.com',
            'uneditable' => true
          }          
        }
      end
      return list
    elsif ['pixabay_vectors', 'pixabay_photos'].include?(library)
      type = library.match(/vector/) ? 'vector' : 'photo'
      key = ENV['PIXABAY_KEY']
      return [] unless key
      url = "https://pixabay.com/api/?key=#{key}&q=#{CGI.escape(keyword)}&image_type=#{type}&per_page=30&safesearch=true"
      req = Typhoeus.get(url, :ssl_verifypeer => false)
      results = JSON.parse(req.body) rescue nil
      return [] unless results && results['hits']
      list = []
      results['hits'].each do |obj|
        ext = obj['webformatURL'].split(/\./)[-1]
        type = MIME::Types.type_for(ext)[0]
        list << {
          'url' => obj['webformatURL'],
          'content_type' => (type && type.content_type) || 'image/jpeg',
          'width' => obj['webformatWidth'],
          'height' => obj['webformatHeight'],
          'external_id' => obj['id'],
          'public' => true,
          'license' => {
            'type' => 'public_domain',
            'copyright_notice_url' => 'https://creativecommons.org/publicdomain/zero/1.0/',
            'source_url' => obj['pageURL'],
            'author_name' => 'unknown',
            'author_url' => 'https://creativecommons.org/publicdomain/zero/1.0/',
            'uneditable' => true
          }          
        }
      end
      return list
    elsif ['noun-project', 'sclera', 'arasaac', 'mulberry', 'tawasol'].include?(library)
      str = "#{keyword} repo:#{library}"
      res = Typhoeus.get("https://www.opensymbols.org/api/v1/symbols/search?q=#{CGI.escape(str)}", :ssl_verifypeer => false)
      results = JSON.parse(res.body)
      results.each do |result|
        if result['extension']
          type = MIME::Types.type_for(result['extension'])[0]
          result['content_type'] = type.content_type
        end
      end
      return [] if results.empty?
      list = []
      results.each do |obj|
        list << {
          'url' => obj['image_url'],
          'content_type' => obj['content_type'],
          'width' => obj['width'],
          'height' => obj['height'],
          'external_id' => obj['id'],
          'public' => true,
          'license' => {
            'type' => obj['license'],
            'copyright_notice_url' => obj['license_url'],
            'source_url' => obj['source_url'],
            'author_name' => obj['author'],
            'author_url' => obj['author_url'],
            'uneditable' => true
          }
        }        
      end
      return list
    end
    return []
  end
end
