module Notifiable
  extend ActiveSupport::Concern
  
  def record_code
    "#{self.class.to_s}:#{self.global_id}"
  end
  
  def handle_notification(notification_type, record, args=nil)
  end
  
  def channels_for(notification_type)
    if notification_type == 'email_changed_prior_address'
      [self.prior_named_email].compact
    elsif ['password_changed', 'email_changed', 'forgot_password'].include?(notification_type)
      [self.named_email]
    else
      if self.settings['email_disabled']
        []
      else
        [self.named_email]
      end
    end
  end

end