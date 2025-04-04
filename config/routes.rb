LingoLinq::RESERVED_ROUTES ||= [
  'admin', 'etc', 'settings', 'status', 'reports', 'stats', 'search', 
  'messages', 'inbox', 'log', 'logs', 'session', 'sessions', 'imports', 
  'boards', 'users', 'groups', 'organizations', 'pages', 'people', 'videos', 
  'root', 'www', 'add', 'self', 'files', 'feeds', 
  'dev', 'auth', 'config', 'jobs', 'ssl', 'integration', 'integrations',
  'api', 'account', 'accounts', 'oauth', 'oauth_success', 'token', 
  'login', 'logout', 'register', 'profile', 'forgot_password', 
  'support', 'help', 'forum', 'talk', 'chat', 'feedback', 'faq', 
  'about', 'contact', 'info', 'docs', 'purchase', 'pricing', 'careers', 
  'news', 'styleguide', 'tour', 'compare', 'guides', 'partners', 
  'privacy', 'terms', 'hipaa', 'accessibility', 'history',
  'js', 'css', 'scripts', 'script', 'pics', 'images', 'lessons', 'lesson', 
  'find', 'unknown', 'nobody', 'goals', 'notes', 'rooms', 'coughdrop', 'cough_drop',
  'mycoughdrop', 'inflection', 'inflections', 'saml'
]
require 'resque/server'
require 'admin_constraint'

LingoLinq::Application.routes.draw do
  # The priority is based upon order of creation: first created -> highest priority.
  # See how all your routes lay out with "rake routes".

  ember_handler = 'boards#index'
  board_id_regex = /[a-zA-Z0-9_-]+\/[a-zA-Z0-9_:%-]+|\d+_\d+(-\d+_\d+)?/
  user_id_regex = /[a-zA-Z0-9_-]+/

  # protected_resque = Rack::Auth::Basic.new(Resque::Server) do |username, password|
  #   u = User.find_by(:user_name => username)
  #   u && u.settings['admin'] && u.valid_password?(password)
  # end
  # mount protected_resque, :at => "/resque"
  
  mount Resque::Server, at: "/jobby", :constraints => AdminConstraint.new

  root ember_handler
  get '/goal_status/:goal_id/:goal_code' => 'boards#log_goal_status'
  get '/cache' => 'boards#cache'
  get '/videos/:source/:id' => 'boards#video'
  get '/privacy' => 'boards#privacy'
  get '/privacy_practices' => 'boards#privacy_practices'
  get '/terms' => 'boards#terms'
  get '/jobs' => 'boards#jobs'
  get '/about' => 'boards#about'
  get '/inflections/:word_id/:locale' => ember_handler
  get '/start_codes/:code' => ember_handler
  
  get 'oauth2/token' => 'session#oauth'
  post 'oauth2/token/login' => 'session#oauth_login'
  post 'oauth2/token' => 'session#oauth_token'
  post 'api/v1/auth/admin' => 'session#auth_admin'
  delete 'oauth2/token' => 'session#oauth_logout'
  get 'oauth2/token/status' => 'session#oauth_local', :as => 'oauth_local'
  post 'auth/lookup' => 'session#auth_lookup'
  get 'saml/init/:org_id' => 'session#saml_redirect'
  get 'saml/init' => 'session#saml_start'
  post 'saml/tmp_token' => 'session#saml_tmp_token'
  get 'saml/metadata' => 'session#saml_metadata'
  get 'saml/logout' => 'session#saml_idp_logout_request'
  post 'saml/consume' => 'session#saml_consume'

  post 'api/v1/token/refresh' => 'session#oauth_token_refresh'
  post 'token' => 'session#token'
  post 'wait/token' => 'session#token_wait'

  get 'lessons/:lesson_id/:lesson_code/:user_token' => 'boards#lesson'
  
  # if Rails.env.production?
    offline = Rack::Offline.configure :cache_interval => 120 do
      cache ActionController::Base.helpers.asset_path("application.css")
      cache ActionController::Base.helpers.asset_path("application.js")
      cache "/fonts/glyphicons-halflings-regular.eot"
      cache "/fonts/glyphicons-halflings-regular.svg"
      cache "/fonts/glyphicons-halflings-regular.ttf"
      cache "/fonts/glyphicons-halflings-regular.woff"
      cache "/fonts/OpenDyslexicAlta-Regular.otf"
      cache "/fonts/ArchitectsDaughter.ttf"
      cache "/images/star.png"
      cache "/images/logo-small.png"
      cache "/images/logo-big.png"
      cache "/images/star_gray.png"
      cache "/images/folder.png"
      cache "/images/folder_home.png"
      cache "/images/folder_integration.png"
      cache "/images/spinner.gif"
      cache "/images/talk.png"
      cache "/images/link.png"
      cache "/images/video.svg"
      cache "/images/app.png"
      cache "/images/orange.png"
      cache "/images/preview.png"
      cache "/images/stats.png"
      cache "/images/microphone.svg"
      cache "/images/upload.svg"
      cache "/images/camera.svg"
      cache "/images/delete.svg"
      cache "/images/square.svg"
      cache "/images/modeling_ideas.svg"
      cache "/images/bar_chart.svg"
      cache "/images/eye.svg"
      cache "/images/cursor.png"
      cache "/images/extras.svg"
      cache "/images/blank.gif"
      cache "/images/cc.png"
      cache "/images/pd.png"
      cache "/images/unknown_action.png"
      cache "/images/settings.png"
      cache "/images/jquery.minicolors.png"
      cache "/images/web_version.svg"
      cache "/images/ios_app_store.svg"
      cache "/images/google_play.png"
      cache "/images/amazon.png"
      cache "/images/faces.png"
      cache "/images/clock.png"
      cache "/images/error.png"
      cache "/images/check.png"
      cache "/images/action.png"
      cache "/offline"
      # cache other assets

      fallback({"/" => "/offline"})
      fallback({"/oauth2/" => "/404"})
      fallback({"/api/" => "/offline.json"})

      network "*"  
    end
    get "/application.manifest" => offline  
  # end
  
  get 'profile' => ember_handler
  get 'profile/:user_id/:profile_id' => ember_handler
  get 'search/:query' => ember_handler
  get 'search/:locale/:query' => ember_handler
  get 'u/:reply_code' => 'boards#utterance_redirect'
  get ':id/logs/:log_id' => ember_handler, :constraints => {:id => user_id_regex}
  get ':id/goals/:goal_id' => ember_handler, :constraints => {:id => user_id_regex}
  
  get 'utterances/:id' => 'boards#utterance'  
  get ':id' => 'boards#user', :constraints => {:id => user_id_regex}
  get ':id' => 'boards#board', :constraints => {:id => board_id_regex}
  get ':id/icon' => 'boards#icon', :constraints => {:id => board_id_regex}
  get ':id/history' => 'boards#board', :constraints => {:id => board_id_regex}
    
  get 'login' => ember_handler
  get 'organizations/:org_id/:path' => ember_handler
  get 'organizations/:org_id/rooms/:room_id' => ember_handler
  get ':id/confirm_registration/:key' => ember_handler, :constraints => {:id => user_id_regex}
  get ':id/password_reset/:key' => ember_handler, :constraints => {:id => user_id_regex}
  post 'api/v1/status' => 'session#status'
  get 'api/v1/status' => 'session#status'
  get 'api/v1/token_check' => 'session#token_check'
  get 'api/v1/status/heartbeat' => 'session#heartbeat'
  
  scope 'api/v1', module: 'api' do
    post 'forgot_password' => 'users#forgot_password'
    post 'messages' => 'messages#create'
    post 'callback' => 'callbacks#callback'
    get 'domain_settings' => 'integrations#domain_settings'
    get 'start_code' => 'organizations#start_code_lookup'
    post 'focus/usage' => 'integrations#focus_usage'
    get 'lang/:locale' => 'words#lang'
    
    resources :boards, :constraints => {:id => board_id_regex} do
      get 'stats' => 'boards#stats'
      get 'simple.obf' => 'boards#simple_obf'
      post 'imports' => 'boards#import', on: :collection
      post 'unlink' => 'boards#unlink', on: :collection
      post 'stars' => 'boards#star'
      post 'slice_locales' => 'boards#slice_locales'
      delete 'stars' => 'boards#unstar'
      post 'download' => 'boards#download'
      post 'rename' => 'boards#rename'
      post 'share_response' => 'boards#share_response'
      get 'copies' => 'boards#copies'
      post 'translate' => 'boards#translate'
      post 'swap_images' => 'boards#swap_images'
      post 'privacy' => 'boards#update_privacy'
      post 'tag' => 'boards#tag'
      post 'rollback' => 'boards#rollback'
    end

    resources :tags
    resources :words do
      get 'reachable_core' => 'words#reachable_core', on: :collection
    end
    
    resources :users do
      get 'stats/daily' => 'users#daily_stats'
      get 'stats/hourly' => 'users#hourly_stats'
      get 'alerts' => 'users#alerts'
      get 'valet_credentials' => 'users#valet_credentials'
      post 'confirm_registration'
      post 'password_reset'
      post 'replace_board'
      post 'copy_board_links'
      post 'subscription' => 'users#subscribe'
      delete 'subscription' => 'users#unsubscribe'
      post 'verify_receipt' => 'users#verify_receipt'
      post 'flush/logs' => 'users#flush_logs'
      post 'flush/user' => 'users#flush_user'
      delete 'devices/:device_id' => 'users#hide_device'
      put 'devices/:device_id' => 'users#rename_device'
      get 'supervisors' => 'users#supervisors'
      get 'supervisees' => 'users#supervisees'
      post 'claim_voice' => 'users#claim_voice'
      post 'start_code' => 'users#start_code'
      post 'rename' => 'users#rename'
      post 'activate_button' => 'users#activate_button'
      get 'sync_stamp' => 'users#sync_stamp'
      post 'translate' => 'users#translate'
      get 'board_revisions' => 'users#board_revisions'
      get 'boards' => 'users#boards'
      get 'places' => 'users#places'
      get 'ws_settings' => 'users#ws_settings'
      get 'ws_lookup' => 'users#ws_lookup'
      post 'ws_encrypt' => 'users#ws_encrypt'
      post 'ws_decrypt' => 'users#ws_decrypt'
      get 'daily_use' => 'users#daily_use'
      get 'core_lists' => 'users#core_lists'
      put 'core_list' => 'users#update_core_list'
      get 'message_bank_suggestions' => 'users#message_bank_suggestions'
      get 'protected_image/:library/:image_id' => 'users#protected_image'
      get 'word_map' => 'users#word_map'
      get 'word_activities' => 'users#word_activities'
      post 'evals/transfer' => 'users#transfer_eval'
      post 'evals/reset' => 'users#reset_eval'
      post '2fa' => 'users#update_2fa'
      get 'external_nonce/:nonce_id' => 'users#external_nonce'
    end
  end
end
