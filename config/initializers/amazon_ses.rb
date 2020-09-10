# require 'aws-sdk-ses'
# ActionMailer::Base.add_delivery_method :ses, AWS::SES::Base,
#   :access_key_id     => ENV['SES_KEY'] || ENV['AWS_KEY'],
#   :secret_access_key => ENV['SES_SECRET'] || ENV['AWS_SECRET']

ActionMailer::Base.add_delivery_method :ses, Mail::SES,
region: ENV['SES_REGION'],
access_key_id: ENV['SES_KEY'] || ENV['AWS_KEY'],
secret_access_key: ENV['SES_SECRET'] || ENV['AWS_SECRET'],
error_handler: ->(error, raw_email) do
  # Bugsnag.notify(error){|r| r.add_tab('email', { email: raw_email })}
  raise error    
end    
