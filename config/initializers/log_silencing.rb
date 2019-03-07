require 'silencer/logger'

module LogSilencing
  class Coughdrop::Application < Rails::Application
    config.middleware.swap Rails::Rack::Logger, Silencer::Logger, config.log_tags
  end
end