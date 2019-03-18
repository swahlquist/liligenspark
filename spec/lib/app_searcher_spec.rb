require 'spec_helper'

describe AppSearcher do
  describe "load_schemes" do
    it "should load the schemes file properly" do
      json = JSON.parse(File.read('./config/app_schemes.json'))
      expect(AppSearcher.load_schemes).to eq(json)
      expect(AppSearcher.class_variable_get('@@schemes')).to eq(json)
    end
  end
  
  describe "update_apps" do
    it "should not error if no apps or packages defined" do
      expect { AppSearcher.update_apps({}) }.not_to raise_error
      hash = {
        'ios' => {},
        'android' => {},
        'bacon' => {}
      }
      hash2 = hash.dup
      expect(AppSearcher.update_apps(hash2).to_json).to eq(hash.to_json)
    end
    it "should update apps if custom is not set and the app has a package name defined" do
      expect(AppSearcher).to receive(:load_schemes).exactly(2).times.and_return({
        'ios' => {
          'friendship' => 'https://www.example.com'
        },
        'android' => {
          'friendship' => 'https://www.example.com'
        }
      })
      hash = {
        'ios' => {'package' => 'friendship'},
        'android' => {'package' => 'friendship'}
      }
      AppSearcher.update_apps(hash)
      expect(hash['ios']['launch_url']).to eq('https://www.example.com')
      expect(hash['android']['launch_url']).to eq('https://www.example.com')
      
      hash = {
        'ios' => {'package' => 'friendship', 'launch_url' => 'http://www.example.com'},
        'android' => {'package' => 'friendship', 'launch_url' => 'http://www.example.com'}
      }
      AppSearcher.update_apps(hash)
      expect(hash['ios']['launch_url']).to eq('https://www.example.com')
      expect(hash['android']['launch_url']).to eq('https://www.example.com')
    end
    
    it "should not update the apps if custom is set" do
      expect(AppSearcher).to receive(:load_schemes).exactly(2).times.and_return({
        'ios' => {
          'friendship' => 'https://www.example.com'
        },
        'android' => {
          'friendship' => 'https://www.example.com'
        }
      })
      hash = {
        'ios' => {'custom' => true, 'package' => 'friendship'},
        'android' => {'custom' => true, 'package' => 'friendship'}
      }
      AppSearcher.update_apps(hash)
      expect(hash['ios']['launch_url']).to eq(nil)
      expect(hash['android']['launch_url']).to eq(nil)
      
      hash = {
        'ios' => {'custom' => true, 'package' => 'friendship', 'launch_url' => 'http://www.example.com'},
        'android' => {'custom' => true, 'package' => 'friendship', 'launch_url' => 'http://www.example.com'}
      }
      AppSearcher.update_apps(hash)
      expect(hash['ios']['launch_url']).to eq('http://www.example.com')
      expect(hash['android']['launch_url']).to eq('http://www.example.com')
    end
  end
  
  describe "find" do
    it "should return a processed list of android results, including launch urls where available" do
      expect(AppSearcher).to receive(:load_schemes).and_return({
        'android' => {
          'friendship' => 'https://www.example.com'
        }
      })
      results = [
        OpenStruct.new({
          'name' => 'awesome',
          'developer' => 'somebody',
          'url' => 'http://www.example.com',
          'logo_url' => 'http://www.example.com/icon.png',
          'price' => 0,
          'short_description' => "This is one cool app",
          'id' => 'friendship',
        }),
        OpenStruct.new({
          'name' => 'awesome',
          'developer' => 'somebody',
          'url' => 'http://www.example.com',
          'logo_url' => 'http://www.example.com/icon.png',
          'price' => 0,
          'short_description' => "This is one cool app",
          'id' => 'friendship2',
        })
      ]
      expect_any_instance_of(GooglePlaySearch::Search).to receive(:search).with('hat').and_return(results)
      expect(AppSearcher.find('hat', 'android')).to eq([{
        'name' => 'awesome',
        'author_name' => 'somebody',
        'author_url' => 'http://www.example.com',
        'image_url' => 'http://www.example.com/icon.png',
        'price' => 0,
        'description' => "This is one cool app",
        'view_url' => 'http://www.example.com',
        'package' => 'friendship',
        'id' => 'friendship',
        'launch_url' => 'https://www.example.com'
      }, {
        'name' => 'awesome',
        'author_name' => 'somebody',
        'author_url' => 'http://www.example.com',
        'image_url' => 'http://www.example.com/icon.png',
        'price' => 0,
        'description' => "This is one cool app",
        'view_url' => 'http://www.example.com',
        'package' => 'friendship2',
        'id' => 'friendship2'
      }])
    end
    
    it "should return only the first fifteen android results" do
      result = {
        'name' => 'awesome',
        'developer' => 'somebody',
        'url' => 'http://www.example.com',
        'logo_url' => 'http://www.example.com/icon.png',
        'price' => 0,
        'short_description' => "This is one cool app"
      }
      results = []
      20.times do |i|
        r = result.dup
        r['package'] = "app#{i}"
        results << OpenStruct.new(r)
      end
      expect_any_instance_of(GooglePlaySearch::Search).to receive(:search).with('hat').and_return(results)
      res = AppSearcher.find('hat', 'android')
      expect(res.length).to eq(15)
    end

    it "should return a processed list of ios results" do
      expect(AppSearcher).to receive(:load_schemes).and_return({
        'ios' => {
          'friendship' => 'https://www.example.com'
        }
      })

      obj = OpenStruct.new({
        body: {'results' => [
          {
            'trackName' => 'awesome',
            'artistName' => 'somebody',
            'artistViewUrl' => 'http://www.example.com',
            'artworkUrl60' => 'http://www.example.com/icon.png',
            'price' => 0,
            'description' => "This is one cool app",
            'trackViewUrl' => 'http://www.example.com/market',
            'bundleId' => 'friendship',
            'trackId' => 1293852
          },
          {
            'trackName' => 'awesome',
            'artistName' => 'somebody',
            'artistViewUrl' => 'http://www.example.com',
            'artworkUrl60' => 'http://www.example.com/icon.png',
            'price' => 0,
            'description' => "This is one cool app",
            'trackViewUrl' => 'http://www.example.com/market',
            'bundleId' => 'friendship2',
            'trackId' => 3246342
          }
        ]}.to_json
      })
      expect(Typhoeus).to receive(:get).with("https://itunes.apple.com/search?term=hat&media=software", {timeout: 3}).and_return(obj)
      expect(AppSearcher.find('hat', 'ios')).to eq([{
        'name' => 'awesome',
        'author_name' => 'somebody',
        'author_url' => 'http://www.example.com',
        'image_url' => 'http://www.example.com/icon.png',
        'price' => 0,
        'description' => "This is one cool app",
        'view_url' => 'http://www.example.com/market',
        'package' => 'friendship',
        'id' => 1293852,
        'launch_url' => 'https://www.example.com'
      }, {
        'name' => 'awesome',
        'author_name' => 'somebody',
        'author_url' => 'http://www.example.com',
        'image_url' => 'http://www.example.com/icon.png',
        'price' => 0,
        'description' => "This is one cool app",
        'view_url' => 'http://www.example.com/market',
        'package' => 'friendship2',
        'id' => 3246342
      }])
    end
    
    it "should return only the first fifteen ios results" do
      result = {
        'trackName' => 'awesome',
        'artistName' => 'somebody',
        'artistViewUrl' => 'http://www.example.com',
        'artworkUrl60' => 'http://www.example.com/icon.png',
        'price' => 0,
        'description' => "This is one cool app",
        'trackViewUrl' => 'http://www.example.com/market'
      }
      results = []
      20.times do |i|
        r = result.dup
        r['bundleId'] = "app#{i}"
        r['trackId'] = i
        results << r
      end
      obj = OpenStruct.new({
        body: {'results' => results}.to_json
      })
      expect(Typhoeus).to receive(:get).with("https://itunes.apple.com/search?term=hat&media=software", {timeout: 3}).and_return(obj)
      res = AppSearcher.find('hat', 'ios')
      expect(res.length).to eq(15)
    end
    
    it "should return an empty list for non-android and non-ios systems" do
      expect(Typhoeus).not_to receive(:get)
      expect(AppSearcher.find('hat', 'fred')).to eq([])
      expect(AppSearcher.find('hat', 'bacon')).to eq([])
      expect(AppSearcher.find('hat', 'windowsphone')).to eq([])
      expect(AppSearcher.find('hat', 'opera')).to eq([])
    end
  end
end
