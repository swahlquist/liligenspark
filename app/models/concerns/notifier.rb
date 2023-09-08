module Notifier
  extend ActiveSupport::Concern
  
  def record_code
    "#{self.class.to_s}:#{self.global_id}"
  end
    
  def notify(notification_type, additional_args=nil)
    if additional_args && additional_args['immediate']
      Webhook.notify_all_with_code(self.record_code, notification_type, additional_args)
    elsif additional_args && additional_args['priority']
      Worker.schedule_for(:priority, Webhook, :notify_all_with_code, self.record_code, notification_type, additional_args)
    elsif additional_args && additional_args['slow']
      Worker.schedule_for(:slow, Webhook, :notify_all_with_code, self.record_code, notification_type, additional_args)    
    else
      Worker.schedule(Webhook, :notify_all_with_code, self.record_code, notification_type, additional_args)
    end
  end
  
  def default_listeners(notification_type)
    []
  end
  
  def additional_listeners(notification_type, additional_args)
    []
  end
  
  def external_listeners(notification_type)
    Webhook.where(:record_code => self.record_code)
  end
end