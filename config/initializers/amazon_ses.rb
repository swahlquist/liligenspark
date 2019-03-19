require 'aws-sdk-ses'
ActionMailer::Base.add_delivery_method :ses, AWS::SES::Base,
  :access_key_id     => ENV['SES_KEY'] || ENV['AWS_KEY'],
  :secret_access_key => ENV['SES_SECRET'] || ENV['AWS_SECRET']