class ApiCall < ActiveRecord::Base
  include SecureSerialize
  secure_serialize :data
  replicated_model
  
  def self.log(token, user, request, response, time)
    # TODO: log all calls from external developer keys
    return true if ENV['DISABLE_API_CALL_LOGGING']
    return true if ENV['DISABLE_SHORT_API_CALL_LOGGING'] && (!time || time < 15)
    if request && request.path && request.path.match(/^\/api\/v\d+/) && token && user && response
      call = ApiCall.new
      call.user_id = user.id
      call.data ||= {}
      call.data['url'] = request.url
      call.data['method'] = request.method
      call.data['access_token'] = token
      call.data['status'] = response.code
      call.data['time'] = time
      call.save
    else
      false
    end
  end
  
  def self.flush
    ApiCall.where(['created_at < ?', 2.months.ago]).delete_all
  end
end
