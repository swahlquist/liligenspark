module AppSearcher
  
  def self.load_schemes
    @@schemes ||= JSON.parse(File.read('./config/app_schemes.json'))
  end
  
  def self.android_token
    ENV['42_MATTERS_ACCESS_TOKEN']
  end
  
  def self.update_apps(apps)
    schemes = load_schemes
    if apps['ios'] && !apps['ios']['custom'] && apps['ios']['package']
      apps['ios']['launch_url'] = schemes['ios'][apps['ios']['package']] if schemes['ios'][apps['ios']['package']]
    end
    if apps['android'] && !apps['android']['custom'] && apps['android']['package']
      apps['android']['launch_url'] = schemes['android'][apps['android']['package']] if schemes['android'][apps['android']['package']]
    end
    apps
  end
  
  def self.find(q, os)
    schemes = load_schemes
    if os == 'android'# && android_token
      gps = GooglePlaySearch::Search.new
      search = gps.search(q)
      results = []
      search[0,15].each do |record|
        result = {}
        result['name'] = record.name
        result['author_name'] = record.developer
        result['author_url'] = record.url
        result['image_url'] = record.logo_url
        result['price'] = record.price
        result['description'] = record.short_description
        result['view_url'] = record.url
        result['package'] = record.id
        result['id'] = record.id
        result['launch_url'] = schemes['android'][result['package']] if schemes['android'][result['package']]
        results << result
      end
      results
    elsif os == 'ios'
      url = "https://itunes.apple.com/search?term=#{CGI.escape(q)}&media=software"
      response = Typhoeus.get(url, timeout: 3)
      json = JSON.parse(response.body)
      results = []
      json['results'][0, 15].each do |record|
        result = {}
        result['name'] = record['trackName']
        result['author_name'] = record['artistName']
        result['author_url'] = record['artistViewUrl']
        result['image_url'] = record['artworkUrl60']
        result['price'] = record['price']
        result['description'] = record['description']
        result['view_url'] = record['trackViewUrl']
        result['package'] = record['bundleId']
        result['id'] = record['trackId']
        result['launch_url'] = schemes['ios'][result['package']] if schemes['ios'][result['package']]
        results << result
      end
      results
    else
      []
    end
  end
end