# This file is used by Rack-based servers to start the application.

begin
  config_path = ::File.expand_path('../config/environment', __FILE__)
  unless File.exist?(config_path)
    raise LoadError, "Required file not found: #{config_path}"
  end

  require config_path
  run Rails.application
rescue LoadError => e
  $stderr.puts "Critical error: #{e.message}"
  exit 1
rescue => e
  $stderr.puts "Error starting the application: #{e.message}"
  $stderr.puts e.backtrace
  exit 1
end
