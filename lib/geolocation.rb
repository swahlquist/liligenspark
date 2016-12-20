module Geolocation
  def self.find_places(lat, long)
    lat = lat.to_f
    long = long.to_f
    token = ENV['GOOGLE_PLACES_TOKEN']
    return [] unless token
    # https://maps.googleapis.com/maps/api/place/nearbysearch/output?parameters
    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json?key=#{token}&location=#{lat.to_s},#{long.to_s}&radius=1000"
    res = Typhoeus.get(url)
    json = JSON.parse(res.body) rescue nil
    if json && json['results']
      res = []
      json['results'].each do |place|
        res << {
          'latitude' => place['geometry']['location']['lat'],
          'longitude' => place['geometry']['location']['lng'],
          'image_url' => place['icon'],
          'name' => place['name'],
          'types' => place['types']
        }
      end
        # there's a delay before next_page_token is available which makes it mostly useless
#       if json['next_page_token'] && res.length < 50
#         sleep 1.0
#         puts "NEXT!"
#         res = Typhoeus.get("https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=#{json['next_page_token']}&key=#{token}")
#         puts res.body
#         json = JSON.parse(response.body) rescue nil
#       else
#         json = nil
#       end
    end
    res
  end
end