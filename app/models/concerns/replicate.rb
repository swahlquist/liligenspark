module Replicate
  extend ActiveSupport::Concern
  
  module ClassMethods
  end

  included do
    # https://prathamesh.tech/2019/08/06/setting-up-rails-6-multiple-databases-on-heroku/
    # connects_to database: { reading: :primary_follower, writing: :primary }
    replicated_model
  end
end