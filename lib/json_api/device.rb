module JsonApi::Device
  extend JsonApi::Json
  
  TYPE_KEY = 'device'
  DEFAULT_PAGE = 25
  MAX_PAGE = 50
  
  def self.build_json(device, args={})
    json = {}
    json['id'] = device.global_id
    json['name'] = device.settings['name']
    json['ref_id'] = (device.device_key || '').split(/\s/)[0]
    json.delete('ref_id') unless json['ref_id']
    json['ip_address'] = device.settings['ip_address']
    json['app_version'] = device.settings['app_version']
    json['user_agent'] = device.settings['user_agent']
    json['mobile'] = true if device.settings['mobile']
    json['last_used'] = device.last_used_at.iso8601
    json['hidden'] = true if device.hidden?
    if args[:current_device] && args[:current_device] == device
      json['current_device'] = true
    end
    json
  end
end