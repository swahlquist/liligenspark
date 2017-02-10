require 'silencer/logger'

module LogSilencing
  class Coughdrop::Application < Rails::Application
    config.middleware.swap Rails::Rack::Logger, Silencer::Logger
  end
end