module JsonApi::Image
  extend JsonApi::Json
  
  TYPE_KEY = 'image'
  DEFAULT_PAGE = 25
  MAX_PAGE = 50
  
  def self.build_json(image, args={})
    json = {}
    json['id'] = image.global_id
    json['url'] = image.best_url
    settings = image.settings
    settings['protected_source'] ||= 'lessonpix' if settings['license'] && settings['license']['source_url'] && settings['license']['source_url'].match(/lessonpix/)
    protected_source = !!image.protected?
    allowed_sources = args[:allowed_sources]
    allowed_sources ||= args[:permissions] && args[:permissions].enabled_protected_sources(true)
    allowed_sources ||= []
    if args[:preferred_source] && args[:preferred_source] != 'default' && args[:preferred_source] != 'original'
      if ['lessonpix', 'pcs', 'symbolstix'].include?(args[:preferred_source]) && !allowed_sources.include?(args[:preferred_source])
      else
        lib = image.image_library
        pref = args[:preferred_source]
        if lib == pref
        elsif image.settings['library_alternates'] && image.settings['library_alternates'][pref]
          settings = image.settings['library_alternates'][pref]
        elsif pref == 'opensymbols' && image.settings['library_alternates']['arasaac']
          settings = image.settings['library_alternates']['arasaac']
        elsif pref == 'opensymbols' && image.settings['library_alternates']['twemoji']
          settings = image.settings['library_alternates']['twemoji']
        end
      end
      pref = nil if pref == 'default' || pref == 'original'
    end
  
    if settings && protected_source && args[:original_and_fallback]
      fb = settings['fallback'] || {}
      json['fallback_url'] = Uploader.fronted_url(fb['url'])
    elsif settings && protected_source && !allowed_sources.include?(settings['protected_source'])
      settings = settings['fallback'] || {}
      json['url'] = Uploader.fronted_url(settings['url'])
      json['fallback'] = true
      protected_source = false
    end
    ['pending', 'content_type', 'width', 'height', 'source_url', 'hc'].each do |key|
      json[key] = settings[key]
    end
    json['protected'] = protected_source
    json['protected_source'] = settings['protected_source'] if json['protected']
    json['license'] = OBF::Utils.parse_license(settings['license'])
    if (args[:data] || !image.url) && image.data
      json['url'] = image.data
    end
    if args[:permissions]
      json['permissions'] = image.permissions_for(args[:permissions])
      if json['permissions']['edit']
        json['alternates'] = image.settings['alternates'] || {}
        lib = image.image_library
        if lib && lib != 'unknown'
          json['alternates'][lib] = {
            'url' => json['url'],
            'license' => json['license'],
            'content_type' => json['content_type']
          }
        end
        json['alternates'].each do |lib, hash|
          hash['library'] = lib
        end
        json.delete('alternates') if json['alternates'] && json['alternates'].keys.length == 0
      end
    end
    json
  end
  
  def self.meta(image)
    json = {}
    if image.pending_upload?
      params = image.remote_upload_params
      json = {'remote_upload' => params}
    end
    json
  end
end