# This file is used by Rack-based servers to start the application.

begin
  require ::File.expand_path('../config/environment', __FILE__)
  run Rails.application
rescue => e
  $stderr.puts "Error starting the application: #{e.message}"
  $stderr.puts e.backtrace
  exit 1
end
