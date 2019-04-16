module ApplicationHelper
  def pretty_loader
    request.path == '/'
  end

  def app_name
    ((@domain_overrides || {})['settings'] || {})['app_name'] || 'CoughDrop'
  end
  
  def crawler?
    pattern = /(googlebot|bingbot|baidu|msnbot)/
    !!(request.user_agent && request.user_agent.match(pattern))
  end
end
