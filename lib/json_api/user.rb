module JsonApi::User
  extend JsonApi::Json
  
  TYPE_KEY = 'user'
  DEFAULT_PAGE = 25
  MAX_PAGE = 50
    
  def self.build_json(user, args={})
    json = {}
    
    json['id'] = user.global_id
    json['user_name'] = user.user_name

    # TODO: find a better home for this
    json['avatar_url'] = user.generated_avatar_url('fallback')
    json['fallback_avatar_url'] = json['avatar_url']
    json['link'] = "#{JsonApi::Json.current_host}/#{user.user_name}"
    
    
    if args.key?(:permissions)
      json['permissions'] = user.permissions_for(args[:permissions])
      json['admin'] = true if ::Organization.admin_manager?(user)
    end
    
    if json['permissions'] && json['permissions']['model']
      json['needs_billing_update'] = !!user.settings['purchase_bounced']
      json['sync_stamp'] = (user.sync_stamp || user.updated_at).utc.iso8601
      json['unread_messages'] = user.settings['unread_messages'] || 0
      json['unread_alerts'] = user.settings['unread_alerts'] || 0
      json['user_token'] = user.user_token
      journal_cutoff = 2.weeks.ago.to_i
      json['vocalizations'] = (user.settings['vocalizations'] || []).select{|v| v['category'] != 'journal' || (v['ts'] && v['ts'] > journal_cutoff) }
      if json['permissions']['delete']
        json['valet_login'] = true if user.valet_allowed?
        json['valet_password_set'] = true if user.settings['valet_password']
        json['valet_disabled'] = true if user.settings['valet_password'] && !user.valet_allowed?
      else
        json['vocalizations'] = json['vocalizations'].select{|v| v['category'] != 'journal' }
      end
      json['contacts'] = user.settings['contacts'] || []
      json['global_integrations'] = UserIntegration.global_integrations
      json['preferences'] = {}
      ::User::PREFERENCE_PARAMS.each do |attr|
        json['preferences'][attr] = user.settings['preferences'][attr]
      end
      json['has_logging_code'] = !json['preferences']['logging_code'].blank?
      json['preferences'].delete('logging_code')
      json['target_words'] = user.settings['target_words'].slice('generated', 'list') if user.settings['target_words']
      json['preferences']['home_board'] = user.settings['preferences']['home_board']
      json['preferences']['progress'] = user.settings['preferences']['progress']
      json['preferences']['protected_usage'] = !user.external_email_allowed?
      if json['preferences']['cookies'] == nil
        json['preferences']['cookies'] = true
      end
      if FeatureFlags.user_created_after?(user, 'word_suggestion_images')
        json['preferences']['word_suggestion_images'] = true if user.settings['preferences']['word_suggestion_images'] == nil
      end
      if json['preferences']['symbol_background'] == nil
        json['preferences']['symbol_background'] = FeatureFlags.user_created_after?(user, 'symbol_background') ? 'clear' : 'white'
      end
      json['feature_flags'] = FeatureFlags.frontend_flags_for(user)
      json['prior_avatar_urls'] = user.prior_avatar_urls
      
      json['goal'] = user.settings['primary_goal']
      json['cell_phone'] = user.settings['cell_phone']
      
      json['preferences']['sidebar_boards'] = user.sidebar_boards
      
      user.settings['preferences']['devices'] ||= {}
      nearest_device = nil
      if user.settings['preferences']['devices'].keys.length > 0
        devices = ::Device.where(:user_id => user.id, :user_integration_id => nil).sort_by{|d| (d.settings['token_history'] || [])[-1] || 0 }.reverse
        last_access = devices.map(&:last_used_at).compact.max
        json['last_access'] = last_access && last_access.iso8601
        if args[:device]
          nearest_device = devices.detect{|d| d != args[:device] && d.settings['name'] == args[:device].settings['name'] && user.settings['preferences']['devices'][d.unique_device_key] }
        end
        nearest_device ||= devices.detect{|d| d.settings['token_history'] && d.settings['token_history'].length > 3 && user.settings['preferences']['devices'][d.unique_device_key] }
        if !nearest_device && user.settings['preferences']['devices'].keys.length == 2
          nearest_device ||= devices.detect{|d| user.settings['preferences']['devices'][d.unique_device_key] }
        end
        json['devices'] = devices.select{|d| !d.hidden? }.map{|d| JsonApi::Device.as_json(d, :current_device => args[:device]) }
      end
      nearest_device_key = (nearest_device && nearest_device.unique_device_key) || 'default'
      
      json['premium_voices'] = user.settings['premium_voices'] if user.settings['premium_voices']
      json['premium_voices']['always_allowed'] = true if json['premium_voices']
      json['premium_voices'] ||= user.default_premium_voices
      json['preferences']['device'] = {}.merge(user.settings['preferences']['devices'][nearest_device_key] || {})
      json['preferences']['device'].delete('ever_synced')
      if args[:device] && user.settings['preferences']['devices'][args[:device].unique_device_key]
        json['preferences']['device'] = json['preferences']['device'].merge(user.settings['preferences']['devices'][args[:device].unique_device_key])
        json['preferences']['device']['id'] = args[:device].global_id
        json['preferences']['device']['name'] = args[:device].settings['name'] || json['preferences']['device']['name']
        json['preferences']['device']['long_token'] = args[:device].settings['long_token']
      end
      if !args[:device] || FeatureFlags.user_created_after?(args[:device], 'browser_no_autosync')
        json['preferences']['device']['ever_synced'] ||= false
      else
        json['preferences']['device']['ever_synced'] = true if json['preferences']['device']['ever_synced'] == nil
      end
      # TODO: remove this (prefer_native_keyboard not on device preference) after June 2020
      json['preferences']['prefer_native_keyboard'] = json['preferences']['device']['prefer_native_keyboard'] == nil ? user.settings['preferences']['prefer_native_keyboard'] : json['preferences']['device']['prefer_native_keyboard']
      if user.eval_account?
        json['preferences']['eval'] = user.settings['eval_reset']
      end

      if FeatureFlags.user_created_after?(user, 'folder_icons')
        json['preferences']['folder_icons'] ||= false
      else
        json['preferences']['folder_icons'] = true if json['preferences']['folder_icons'] == nil
      end
      json['preferences']['device']['voice'] ||= {}
      json['preferences']['device']['alternate_voice'] ||= {}
      if json['preferences']['device']['alternate_voice']['enabled']
        if json['preferences']['device']['alternate_voice']['for_scanning'] == nil
          json['preferences']['device']['alternate_voice']['for_scanning'] = true
        end
        ['for_scanning', 'for_fishing', 'for_buttons'].each do |key|
          json['preferences']['device']['alternate_voice'][key] ||= false
        end
      end

      json['prior_home_boards'] = (user.settings['all_home_boards'] || []).reverse
      if user.settings['preferences']['home_board']
        json['prior_home_boards'] = json['prior_home_boards'].select{|b| b['key'] != user.settings['preferences']['home_board']['key'] }
      end
      
      json['premium'] = user.any_premium_or_grace_period?
      json['terms_agree'] = !!user.settings['terms_agreed']
      json['subscription'] = user.subscription_hash
      json['organizations'] = user.organization_hash
      json['purchase_duration'] = (user.purchase_credit_duration / 1.year.to_f).round(1)
      json['pending_board_shares'] = UserLink.links_for(user).select{|l| l['user_id'] == user.global_id && l['state'] && l['state']['pending'] }.map{|link|
        {
          'user_name' => link['state']['sharer_user_name'] || (link['state']['board_key'] || '').split(/\//)[0],
          'board_key' => link['state']['board_key'],
          'board_id' => link['record_code'].split(/:/)[1],
          'include_downstream' => !!link['state']['include_downstream'],
          'allow_editing' => !!link['state']['allow_editing'],
          'pending' => !!link['state']['pending'],
          'user_id' => link['user_id']
        }
      }

      extra = user.user_extra
      if extra && !args[:paginated]
        tags = (extra.settings['board_tags'] || {}).to_a.map(&:first).sort
        json['board_tags'] = tags if !tags.blank?
        json['focus_words'] = extra.active_focus_words
      end
      
      supervisors = user.supervisors
      supervisees = user.supervisees
      if supervisors.length > 0
        json['supervisors'] = supervisors[0, 10].map{|u| JsonApi::User.as_json(u, limited_identity: true, supervisee: user) }
      end
      if supervisees.length > 0
        json['premium_voices']['claimed'] ||= []
        # Supervisors can download voices activated by supervisees
        # TODO: Limit usage of supervisee-activated voices?
        supervisees.each do |sup|
          json['premium_voices']['claimed'] = json['premium_voices']['claimed'] | ((sup.settings['premium_voices'] || {})['claimed'] || [])
        end
        json['supervisees'] = supervisees[0, 10].map{|u| JsonApi::User.as_json(u, limited_identity: true, supervisor: user) }
        json['supervised_units'] = OrganizationUnit.supervised_units(user).map{|ou|
          {
            'id' => ou.global_id,
            'organization_id' => ou.related_global_id(ou.organization_id),
            'name' => ou.settings['name']
          }
        }
      elsif user.supporter_role?
        json['supervisees'] = []
      end

      if json['subscription'] && json['subscription']['premium_supporter']
        json['subscription']['limited_supervisor'] = true
        # in case you get stuck on the comparator again, this is saying for anybody who signed up
        # less than 2 months ago
        json['subscription']['limited_supervisor'] = false if user.created_at > 2.months.ago 
        json['subscription']['limited_supervisor'] = false if json['subscription']['limited_supervisor'] && Organization.supervisor?(user)
        json['subscription']['limited_supervisor'] = false if json['subscription']['limited_supervisor'] && supervisees.any?{|u| u.any_premium_or_grace_period? }
      end
      
      if user.settings['user_notifications'] && user.settings['user_notifications'].length > 0
        cutoff = 6.weeks.ago.iso8601
        unread_cutoff = user.settings['user_notifications_cutoff'] || user.created_at.utc.iso8601
        json['notifications'] = user.settings['user_notifications'].select{|n| n['added_at'] > cutoff }
        json['notifications'].each{|n| n['unread'] = true if n['added_at'] > unread_cutoff }
      end
      json['read_notifications'] = false
    elsif json['permissions'] && json['permissions']['admin_support_actions']
      json['subscription'] = user.subscription_hash
      ::Device.where(:user_id => user.id).sort_by{|d| (d.settings['token_history'] || [])[-1] || 0 }.reverse
      json['devices'] = devices.select{|d| !d.hidden? }.map{|d| JsonApi::Device.as_json(d, :current_device => args[:device]) }
    elsif args[:include_subscription]
      json['subscription'] = user.subscription_hash
    end
    
    if args[:limited_identity]
      json['name'] = user.settings['name']
      json['avatar_url'] = user.generated_avatar_url
      json['unread_messages'] = user.settings['unread_messages'] || 0
      json['unread_alerts'] = user.settings['unread_alerts'] || 0
      json['email'] = user.settings['email'] if args[:include_email]
      json['remote_modeling'] = !!user.settings['preferences']['remote_modeling']
      if args[:supervisor]
        json['edit_permission'] = args[:supervisor].edit_permission_for?(user)
        json['modeling_only'] = args[:supervisor].modeling_only_for?(user)
        json['premium'] = user.any_premium_or_grace_period?
        json['goal'] = user.settings['primary_goal']
        json['target_words'] = user.settings['target_words'].slice('generated', 'list') if user.settings['target_words']
        json['home_board_key'] = user.settings['preferences'] && user.settings['preferences']['home_board'] && user.settings['preferences']['home_board']['key']
      elsif args[:supervisee]
        json['edit_permission'] = user.edit_permission_for?(args[:supervisee])
        json['modeling_only'] = user.modeling_only_for?(args[:supervisee])
        org_unit = (user.org_units_for_supervising(args[:supervisee]) || [])[0]
        if org_unit
          # json['organization_unit_name'] = org_unit.settings['name']
          json['organization_unit_id'] = org_unit.global_id
        end
      end
      sub_hash = user.subscription_hash
      json['extras_enabled'] = true if sub_hash['extras_enabled']
      if args[:subscription]
        json['subscription'] = sub_hash
        json['subscription']['lessonpix'] = true if UserIntegration.integration_keys_for(user).include?('lessonpix')
      end
      if args[:organization]
        links = UserLink.links_for(user)
        org_code = Webhook.get_record_code(args[:organization])

        manager = !!links.detect{|l| l['type'] == 'org_manager' && l['record_code'] == org_code }
        sup = links.detect{|l| l['type'] == 'org_supervisor' && l['record_code'] == org_code }
        mngd = !!links.detect{|l| l['type'] == 'org_user' && l['record_code'] == org_code }
    
        if args[:organization_manager]
          json['goal'] = user.settings['primary_goal']
        end
        if manager
          json['org_manager'] = args[:organization].manager?(user)
          json['org_assistant'] = args[:organization].assistant?(user)
        end
        if sup
          json['org_supervision_pending'] = args[:organization].pending_supervisor?(user)
          json['org_premium_supervisor'] = true if sup['state']['premium']
          if !json['org_supervision_pending']
            supervisees = []
            if args[:paginated]
              if !args[:org_users]
                hash = {}
                args[:organization].users.select('id', 'user_name').each{|u| hash[u.global_id] = {'id' => u.global_id, 'user_name' => u.user_name } }
                args[:org_users] ||= hash
              end
              json['org_supervisees'] = []
              user.supervised_user_ids.each{|uid| json['org_supervisees'] << args[:org_users][uid] if args[:org_users][uid] }
              json['org_supervisees'].sort_by{|u| u['user_name'] }
            else
              supervisees = args[:organization].users.select('id', 'user_name').limit(10).find_all_by_global_id(user.supervised_user_ids)
              if supervisees.length > 0
                json['org_supervisees'] = supervisees[0, 10].map{|u| 
                  {'id' => u.global_id, 'user_name' => u.user_name }
              }.sort_by{|u| u['user_name'] }
              end
            end
          end
        end
        if mngd
          json['org_pending'] = args[:organization].pending_user?(user)
          json['org_sponsored'] = args[:organization].sponsored_user?(user)
          json['org_eval'] = args[:organization].eval_user?(user)
          json['joined'] = user.created_at.iso8601
        end
      end
    elsif user.settings['public'] || (json['permissions'] && json['permissions']['view_detailed'])
      json['avatar_url'] = user.generated_avatar_url
      json['joined'] = user.created_at.iso8601
      json['email'] = user.settings['email'] 
      json.merge! user.settings.slice('name', 'public', 'description', 'details_url', 'location')
      json['pending'] = true if user.settings['pending']

      json['membership_type'] = user.any_premium_or_grace_period? ? 'premium' : 'free'

      json['stats'] = {}
      json['stats']['starred_boards'] = user.settings['starred_boards'] || 0
      board_ids = user.board_set_ids
      # json['stats']['board_set'] = board_ids.uniq.length
      json['stats']['user_boards'] = Board.where(:user_id => user.id).count
      if json['permissions'] && json['permissions']['view_detailed']
        json['stats']['board_set_ids'] = board_ids.uniq
        if json['supervisees']
          json['stats']['board_set_ids_including_supervisees'] = user.board_set_ids(:include_supervisees => true)
        else 
          json['stats']['board_set_ids_including_supervisees'] = json['stats']['board_set_ids']
        end
      end
    end
    json
  end
end
