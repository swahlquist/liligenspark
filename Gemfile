source 'https://rubygems.org'

# TODO: https://rails-assets.org/ for bower support

group :development, :test do
  gem 'dotenv', '~> 2.0'
  gem 'guard'
  gem 'guard-jasmine'
  gem 'guard-rspec'
  gem 'rspec-rails'
  gem 'simplecov', :require => false
  gem 'rack-test'
  gem 'rails-controller-testing'
end

# Rails 5.2 doesn't seem to work on heroku with octopus :-/
gem 'rails', '5.0.7.2'
gem 'pg' #, '0.19.0' #, '>=1.1.3'
gem 'sass-rails'
gem 'uglifier', '>= 1.3.0'

gem 'typhoeus'
gem 'coffee-rails'
gem 'aws-sdk-rails'
gem 'aws-sdk-sns', '~> 1'
gem 'aws-sdk-ses', '~> 1'
gem 'aws-sdk-elastictranscoder', '~> 1'
gem 'aws-sdk-cloudfront', '~> 1'
gem 'http-2'
gem 'resque'
gem 'rails_12factor', group: :production
gem 'heroku-deflater', :group => :production
gem 'puma'
gem 'rack-offline'
gem 'paper_trail'
gem 'geokit'
gem 'google_play_search'
gem 'obf'
gem 'accessible-books'
gem 's3'
gem 'bugsnag'
gem 'stripe'
gem 'rack-attack'
gem 'newrelic_rpm'
gem 'rack-timeout'
gem 'pg_search'
gem 'silencer'
gem 'go_secure'
gem 'permissable-coughdrop'
gem 'boy_band'
gem 'ttfunk', '1.7'
gem 'ruby-saml'
gem 'rotp'
gem 'matrix'

gem 'ar-octopus', require: 'octopus', git: 'https://github.com/whitmer/octopus'
# TODO: getting errors on load for rails 5, so pinned to beta, this isn't actually a core dependency
gem 'sinatra'
gem 'sanitize'

group :doc do
  # bundle exec rake doc:rails generates the API under doc/api.
  gem 'sdoc', require: false
end



# See https://github.com/sstephenson/execjs#readme for more supported runtimes
# gem 'therubyracer', platforms: :ruby

# Turbolinks makes following links in your web application faster. Read more: https://github.com/rails/turbolinks
# gem 'turbolinks'

# Use ActiveModel has_secure_password
# gem 'bcrypt-ruby', '~> 3.1.2'

# Use Capistrano for deployment
# gem 'capistrano', group: :development

ruby '3.3.7'