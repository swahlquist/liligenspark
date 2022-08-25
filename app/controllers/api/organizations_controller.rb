class Api::OrganizationsController < ApplicationController
  before_action :require_api_token
  before_action :require_org, :except => [:show, :create, :index, :update, :destroy]

  def require_org
    @org = Organization.find_by_global_id(params['organization_id'])
    return false unless exists?(@org, params['organization_id'])
    true
  end
  
  def show
    org = Organization.find_by_global_id(params['id'])
    return unless exists?(org, params['id'])
    return unless allowed?(org, 'view')
    render json: JsonApi::Organization.as_json(org, :wrapper => true, :permissions => @api_user).to_json
  end
  
  def users
    return unless allowed?(@org, 'edit')
    users = @org.users
    if params['recent']
      users = users.order(id: :desc)
    else
      users = users.order('user_name')
    end
    prefix = "/organizations/#{@org.global_id}/users"
    org_manager = @org.allows?(@api_user, 'manage')
    render json: JsonApi::User.paginate(params, users, {:limited_identity => true, :include_email => true, :organization => @org, :prefix => prefix, :organization_manager => org_manager, :profile_type => 'supervisor'})
  end

  def set_status
    if !@org.supervisor?(@api_user) && !@org.manager?(@api_user)
      return allowed?(@api_user, 'never_allow')
    end
    user = @org.users.find_by_path(params['user_id'])
    return unless exists?(user, params['user_id'])
    return unless allowed?(user, 'supervise')
    link = UserLink.where(user_id: user.id).detect{|l| l.data['type'] == 'org_user' }
    if link
      link.data['state'] ||= {}
      link.data['state']['status'] = {
        'date' => Time.now.to_i,
        'state' => params['status']['state']
      }
      if params['status']['note']
        link.data['state']['status']['note'] = params['status']['note']
      end
      link.save
      log_note = "Status set to #{params['status']['state']}"
      log_note += " - #{params['status']['note']}" if params['status']['note']
      LogSession.message({
        recipient: user,
        sender: @api_user,
        message: log_note,
        notify: false
      })
      render json: {updated: true, link_id: link.id, status: link.data['state']['status']}
    else
      return api_error 400, {error: 'user not found in org'}
    end
  end

  def extras
    return unless allowed?(@org, 'edit')
    users = @org.extras_users.sort_by(&:user_name)
    prefix = "/organizations/#{@org.global_id}/extras"
    render json: JsonApi::User.paginate(params, users, {:limited_identity => true, :include_email => true, :organization => @org, :prefix => prefix, :per_page => 500})
  end
  
  def supervisors
    return unless allowed?(@org, 'edit')
    users = @org.supervisors.order('user_name')
    prefix = "/organizations/#{@org.global_id}/supervisors"

    render json: JsonApi::User.paginate(params, users, {:limited_identity => true, :include_email => true, :organization => @org, :prefix => prefix, :profile_type => 'supervisor'})
  end

  def managers
    return unless allowed?(@org, 'edit')
    users = @org.managers.order('user_name')
    prefix = "/organizations/#{@org.global_id}/managers"
    render json: JsonApi::User.paginate(params, users, {:limited_identity => true, :include_email => true, :organization => @org, :prefix => prefix})
  end
  
  def evals
    return unless allowed?(@org, 'edit')
    users = @org.evals.order('user_name')
    prefix = "/organizations/#{@org.global_id}/evals"
    render json: JsonApi::User.paginate(params, users, {:limited_identity => true, :include_email => true, :organization => @org, :prefix => prefix})
  end
  
  def stats
    org = Organization.find_by_path(params['organization_id'])
    return unless allowed?(org, 'edit')

    approved_users = org.approved_users(false)
    # if it's a shell org, go ahead and report on its children
    if approved_users.count == 0
      approved_users += org.downstream_orgs.map{|o| o.approved_users(false) }.flatten
    end

    res = Organization.usage_stats(approved_users.uniq, org.admin?)
    if org.settings['communicator_profile']
      com_ids = approved_users.uniq.map(&:id)
      # TODO: sharding
      com_extras = UserExtra.where(user_id: com_ids)
      recents = []
      com_extras.find_in_batches(batch_size: 50) do |batch|
        batch.each do |extra|
          profs = (extra.settings['recent_profiles'] || {})[org.settings['communicator_profile']['profile_id']]
          recents << profs[-1] if profs && profs[-1] && profs[-1]['added'] > (Time.now - org.profile_frequency('communicator')).to_i
        end
      end
      res['user_counts']['communicators'] = com_ids.length
      res['user_counts']['communicator_recent_profiles'] = recents.length
    end
    if org.settings['supervisor_profile']
      sup_ids = org.attached_users('supervisor').map(&:id)
      # TODO: sharding
      sup_extras = UserExtra.where(user_id: sup_ids)
      recents = []
      sup_extras.find_in_batches(batch_size: 50) do |batch|
        batch.each do |extra|
          profs = (extra.settings['recent_profiles'] || {})[org.settings['supervisor_profile']['profile_id']] || []
          recents << profs[-1] if profs[-1] && profs[-1]['added'] > (Time.now - org.profile_frequency('supervisor')).to_i
        end
      end
      res['user_counts']['supervisors'] = sup_ids.length
      res['user_counts']['supervisor_recent_profiles'] = recents.length

      sessions = LogSession.where(log_type: 'daily_use', user_id:sup_ids)
      cutoff = 12.weeks.ago.to_date.iso8601
      models = {}
      sessions.each do |session|
        user_id = session.related_global_id(session.user_id)
        (session.data['days'] || []).each do |str, day|
          if str > cutoff
            week = Date.parse(str).beginning_of_week(:monday)
            ts = week.to_time(:utc).to_i
            key = 'modeled'
            if(day[key])
              if(key == 'modeled') 
                day[key].each do |word|
                  models[word] = (models[word] || 0) + 1
                end
              end
            end
          end
        end
      end 
      res['user_counts']['supervisor_models'] = models     
    end

    recent_sessions = LogSession.where(log_type: 'session').where(['started_at > ?', 2.weeks.ago])
    if !org.admin?
      recent_sessions = recent_sessions.where(:user_id => User.local_ids(approved_users.map(&:global_id)))
    end
    res['user_counts']['recent_session_count'] = recent_sessions.count
    res['user_counts']['recent_session_user_count'] = recent_sessions.distinct.count('user_id')

    render json: res.to_json
  end
  
  def admin_reports
    org = Organization.find_by_path(params['organization_id'])
    return unless allowed?(org, 'edit')
    # Only the reports in the list should be allowed for non-admins
    if !['logged_2', 'not_logged_2', 'unused_3', 'unused_6', 'summaries'].include?(params['report']) && !(params['report'] || '').match(/^status-/)
      if !org.admin?
        return unless allowed?(org, 'impossible')
      end
    end
    if !params['report']
      return api_error 400, {:error => "report parameter required"}
    end
    users = nil
    stats = nil
    # TODO: make these actually efficient lookups
    if params['report'].match(/^unused_/)
      # logins not used in the last X months
      x = params['report'].split(/_/)[1].to_i
      users = User.where(['created_at < ?', x.months.ago])
      if !org.admin?
        # TODO: sharding
        users = users.where(:id => org.approved_users(false).map(&:id))
        # if it's a shell org, go ahead and report on its children
        if users.count == 0
          users += org.downstream_orgs.map{|o| o.approved_users(false) }.flatten
        end
      end
      users = users.select{|u| u.devices.where(['updated_at < ?', x.months.ago]).count > 0 }
    elsif params['report'] == 'setup_but_expired'
      # TODO: too slow
      # logins that have set a home board, used it at least a week after registering, and have an expired trial
      x = 2
      users = User.where(['expires_at < ?', Time.now]).select{|u| u.settings['preferences'] && u.settings['preferences']['home_board'] && u.devices.where(['updated_at > ?', u.created_at + x.weeks]).count > 0 }
    elsif params['report'] == 'current_but_expired'
      # logins that have set a home board, used it in the last two weeks, and have an expired trial
      x = 2
      log_user_ids = LogSession.where(log_type: 'daily_use').where(['updated_at > ?', x.weeks.ago]).select('id, user_id').map(&:user_id)
      users = User.where(id: log_user_ids).where(['expires_at < ?', Time.now]).select{|u| u.settings && u.settings['preferences'] && u.settings['preferences']['home_board'] }
      # TODO: sharding
      active_user_ids = Device.where(:user_id => users.map(&:id)).where(['updated_at > ?', x.weeks.ago]).map(&:user_id).uniq
      users = users.select{|u| active_user_ids.include?(u.id) }
    elsif params['report'] == 'free_supervisor_without_supervisees'
      # logins that have changed to a free subscription after their trial but don't have any supervisees
      users = User.where({:expires_at => nil}).select{|u| u.modeling_only? && u.supervised_user_ids.blank? }
      users = users.select{|u| !Organization.supervisor?(u) && !Organization.manager?(u) }
    elsif params['report'] == 'active_free_supervisor_without_supervisees_or_org'
      log_user_ids = LogSession.where(log_type: 'daily_use').where(['updated_at > ?', 2.weeks.ago]).select('id, user_id').map(&:user_id)
      users = User.where(id: log_user_ids).where({:expires_at => nil}).select{|u| u.modeling_only? && u.supervised_user_ids.blank? && !Organization.supervisor?(u) }
      # TODO: sharding
      active_user_ids = Device.where(:user_id => users.map(&:id)).where(['updated_at > ?', 2.weeks.ago]).map(&:user_id).uniq
      users = users.select{|u| active_user_ids.include?(u.id) && !Organization.supervisor?(u) && !Organization.manager?(u) }
    elsif params['report'] == 'eval_accounts'
      users = User.where({:expires_at => nil}).select{|u| u.settings['subscription'] && (u.settings['subscription']['plan_id'] || '').match(/^eval/)}
    elsif params['report'] == 'org_sizes'
      stats = {}
      Organization.all.each do |org|
        links = UserLink.links_for(org).select{|l| l['type'] == 'org_user'}
        stats[org.settings['name']] = links.length
      end
    elsif params['report'].match(/home_boards/)
      home_connections = UserBoardConnection.where(:home => true)
      if params['report'].match(/recent/)
        home_connections = home_connections.where(['updated_at > ?', 3.months.ago])
      end
      counts = home_connections.group('parent_board_id').count
      home_connections.where(parent_board_id: nil).group('board_id').count.each do |id, cnt|
        counts[id] ||= 0
        counts[id] += cnt
      end
      board_ids = counts.map(&:first)
      boards = Board.where(:id => board_ids)
      boards_by_id = {}
      boards.each{|b| boards_by_id[b.id] = b }
      
      stats = {}
      boards.each do |board|
        ref = board
        level = 0
        while ref.parent_board_id && boards_by_id[ref.parent_board_id] && level < 5
          level += 1
          ref = boards_by_id[ref.parent_board_id]
        end
        stats[ref.key] ||= 0
        stats[ref.key] += (counts[board.id] || 0)
      end
      stats.each{|k, v| stats.delete(k) if stats[k] <= 1 }
    # elsif params['report'].match(/recent_/)
    #   # logins signed up more than 3 weeks ago that have been used in the last week
    #   x = 3
    #   log_user_ids = LogSession.where(log_type: 'daily_use').where(['updated_at > ?', 1.week.ago]).select('id, user_id').map(&:user_id)
    #   users = User.where(['created_at < ?', x.weeks.ago])
    #   # TODO: sharding
    #   active_user_ids = Device.where(:user_id => users.map(&:id)).where(['updated_at > ?', 1.week.ago]).map(&:user_id).uniq 
    #   users = users.select{|u| active_user_ids.include?(u.id) }
    elsif params['report'] == 'new_users'
      x = 2
      users = User.where(['created_at > ?', x.weeks.ago])
    elsif params['report'].match(/status-/)
      status = params['report'].split(/-/, 2)[1]
      links = UserLink.links_for(org).select{|l| l['type'] == 'org_user' && (((l['state'] || {})['status'] || {})['state'] || 'unchecked') == status }
      statuses = {}
      if !org.admin?
        # TODO: sharding
        org.downstream_orgs.each do |o|
          links += UserLink.links_for(o).select{|l| l['type'] == 'org_user' && (((l['state'] || {})['status'] || {})['state'] || 'unchecked') == status }
        end
      end
      links.each{|l| statuses[l['user_id']] ||= l['state']['status'] || {'state' => 'unchecked'} }

      users = User.find_all_by_global_id(links.map{|l| l['user_id'] }.uniq)
      users.each do |u|
        u.instance_variable_set('@org_status', statuses[u.global_id])
      end
    elsif params['report'].match(/logged_/)
      # logins that have generated logs in the last 2 weeks
      x = params['report'].split(/_/)[1].to_i
      sessions = LogSession.where(['created_at > ?', x.weeks.ago])
      if !org.admin?
        # TODO: sharding
        sessions = sessions.where(:user_id => org.approved_users(false).map(&:id))
      end
      user_ids = sessions.group('id, user_id').count('user_id').map(&:first)
      users = User.where(:id => user_ids)
    elsif params['report'] == 'subscriptions'
      stats = {}
      User.where(:possibly_full_premium => true).where(['created_at > ? OR expires_at > ?', 4.months.ago, 3.years.from_now]).each do |user|
        if user.full_premium?
          amount = nil
          ts = nil
          if user.long_term_purchase?
            ts = user.settings['subscription']['last_purchased'] || (user.expires_at - 5.years).iso8601
            match = user.settings['subscription']['last_purchase_plan_id'].match(/long_term_(\d+)/)
            amount = match && match[1].to_i
          elsif user.recurring_subscription?
            ts = user.settings['subscription']['started']
            match = user.settings['subscription']['plan_id'].match(/monthly_(\d+)/)
            amount = match && match[1].to_i
          end
          if amount && ts && amount > 0
            key = ts[0, 7] + "_" + amount.to_s
            stats[key] ||= 0
            stats[key] += 1
          end
        end
      end
    elsif params['report'].match(/not_logged_/)
      # logins that have generated logs in the last 2 weeks
      x = params['report'].split(/_/)[1].to_i
      sessions = LogSession.where(['created_at > ?', x.weeks.ago])
      approved_user_ids = org.approved_users(false).map(&:id)
      # TODO: sharding
      sessions = sessions.where(:user_id => org.approved_users(false).map(&:id))
      session_user_ids = sessions.group('id, user_id').count('user_id').map(&:first)
      missing_user_ids = approved_user_ids - session_user_ids
      users = User.where(:id => missing_user_ids)
    elsif params['report'] == 'missing_words'
      stats = RedisInit.default ? RedisInit.default.hgetall('missing_words') : {}
    elsif params['report'] == 'missing_symbols'
      stats = RedisInit.default ? RedisInit.default.hgetall('missing_symbols') : {}
    elsif params['report'] == 'overridden_parts_of_speech'
      stats = RedisInit.default ? RedisInit.default.hgetall('overridden_parts_of_speech') : {}
    # elsif params['report'] == 'multiple_emails'
    #   counts = User.all.group('email_hash').having('count(*) > 1').count
    #   users = User.where({email_hash: counts.map(&:first)}); users.count
    #   hashes = {}
    #   stats = {}
    #   users.find_in_batches(batch_size: 500).each do |batch|
    #     batch.each do |u|
    #       hashes[u.email_hash] = (u.settings['email'] || 'none') unless hashes[u.email_hash]
    #       stats[hashes[u.email_hash]] ||= []
    #       stats[hashes[u.email_hash]] << u.user_name
    #     end
    #   end
    #   stats.each{|k, v| stats[k] = stats[k].join(',') }
    elsif params['report'] == 'premium_voices'
      voices = AuditEvent.where(['created_at > ? AND event_type = ?', 8.months.ago, 'voice_added'])
      stats = {}
      voices.each do |event|
        str = "#{event.created_at.strftime('%m-%Y')} #{event.data['voice_id']} #{event.data['system'] || 'iOS'}"
        stats[str] ||= 0
        stats[str] += 1
      end
    elsif params['report'] == 'extras'
      extras = AuditEvent.where(['created_at > ? AND event_type = ?', 8.months.ago, 'extras_added'])
      stats = {}
      extras.each do |event|
        str = "#{event.created_at.strftime('%m-%Y')} #{event.data['source']}"
        stats[str] ||= 0
        stats[str] += 1
      end
    elsif params['report'] == 'protected_sources'
      extras = AuditEvent.where(['created_at > ? AND event_type = ?', 8.months.ago, 'source_activated'])
      stats = {}
      extras.each do |event|
        str = "#{event.created_at.strftime('%m-%Y')} #{event.data['source']}"
        stats[str] ||= 0
        stats[str] += 1
      end
    elsif params['report'] == 'feature_flags'
      available = FeatureFlags::AVAILABLE_FRONTEND_FEATURES
      enabled = FeatureFlags::ENABLED_FRONTEND_FEATURES
      stats = {}
      available.each do |flag|
        key = flag
        key += " (enabled)" if enabled.include?(flag)
        stats[key] = enabled.include?(flag) ? 1 : 0
      end
    elsif params['report'] == 'totals'
      stats = {}
      stats['users'] = User.count
      stats['boards'] = Board.count
      stats['devices'] = Device.count
      stats['logs'] = LogSession.count
      stats['organizations'] = Organization.count
      stats['versions'] = PaperTrail::Version.count
    elsif params['report'] == 'summaries'
      # TODO: Users clustered by total available words
      approved_users = org.approved_users(false)
      # if it's a shell org, go ahead and report on its children
      if approved_users.count == 0
        approved_users += org.downstream_orgs.map{|o| o.approved_users(false) }.flatten
      end
      methods = {}
      devices = {}
      vocabs = {}
      statuses = {}
      sizes = []
      board_ids = []
      links = UserLink.links_for(org).select{|l| l['type'] == 'org_user' && l['state']['status'] }
      approved_users.each do |user|
        if user.settings['preferences']['home_board']
          board_ids.push(user.settings['preferences']['home_board']['id'])
        end
        link = links.detect{|l| l['user_id'] == user.global_id }
        state = link && link['state'] && link['state']['status'] && link['state']['status']['state']
        state ||= 'unchecked'
        statuses[state] = (statuses[state] || 0) + 1
      end
      boards_hash = {}
      Board.find_batches_by_global_id(board_ids.uniq){|b| boards_hash[b.global_id] = b }
      approved_users.each do |user|
        user.access_methods.each{|m| methods[m] = (methods[m] || 0) + 1 }
        if user.settings['external_device']
          dn = user.settings['external_device']['device_name']
          dn = "Unnamed" if dn.blank?
          devices[dn] = (devices[dn] || 0) + 1
          vocabs[user.settings['external_device']['vocab_name']] = (vocabs[user.settings['external_device']['vocab_name']] || 0) + 1
          sizes << user.settings['external_device']['size']
        elsif user.settings['preferences']['home_board']
          brd = boards_hash[user.settings['preferences']['home_board']['id']]
          grid = BoardContent.load_content(brd, 'grid')
          devices['CoughDrop'] = (devices['CoughDrop'] || 0) + 1
          if brd.key.match(/\/core-\d/)
            vocabs['Quick Core'] = (vocabs['Quick Core'] || 0) + 1
          elsif brd.key.match(/vocal-flair/)
            vocabs['Vocal Flair'] = (vocabs['Vocal Flair'] || 0) + 1
          elsif brd.key.match(/sequoia/)
            vocabs['Sequoia'] = (vocabs['Sequoia'] || 0) + 1
          else
            key = brd.key.split(/\//)[1].sub(/_\d+$/, '')
            vocabs[key] = (vocabs[key] || 0) + 1
          end
          sizes << (grid['rows'] || 3) * (grid['columns'] || 4)
          brd.settings['downstream_board_ids'].length
        else
          devices['No Device'] = (devices['No Device'] || 0) + 1
        end
      end
      stats = {}
      stats['access_methods'] = methods
      stats['devices'] = devices
      stats['vocabs'] = vocabs
      stats['statuses'] = statuses
      sizes_hash = {}
      sizes.each do |size|
        lower = size - (size % 30)
        range = "#{lower}-#{lower + 29} cells"
        sizes_hash[range] = (sizes_hash[range] || 0) + 1
      end
      stats['sizes'] = sizes_hash
    else
      return api_error 400, {:error => "unrecognized report: #{params['report']}"}
    end
    res = {}
    res[:user] = users.sort_by(&:user_name).map{|u| 
      r = JsonApi::User.as_json(u, limited_identity: true); 
      r['org_status'] = u.instance_variable_get('@org_status') if u.instance_variable_get('@org_status')
      r['email'] = u.settings['email'];
      if org.admin?
        r['referrer'] = u.settings['referrer']
        r['ad_referrer'] = u.settings['ad_referrer']
        r['registration_type'] = u.registration_type
        r['joined'] = u.created_at.iso8601
      end
      r 
    } if users
    res[:stats] = stats if stats
    render json: res.to_json
  end
  
  def logs
    return unless allowed?(@org, 'manage')
    logs = @org.log_sessions.order(id: :desc)
    prefix = "/organizations/#{@org.global_id}/logs"
    render json: JsonApi::Log.paginate(params, logs, {:prefix => prefix})
  end
  
  def blocked_emails
    if !@org.admin
      return allowed?(@org, 'never_allowed')
    end
    return unless allowed?(@org, 'manage')
    render json: {emails: Setting.blocked_emails}
  end
  
  def blocked_cells
    if !@org.admin
      return allowed?(@org, 'never_allowed')
    end
    return unless allowed?(@org, 'manage')
    render json: {cells: Setting.blocked_cells}
  end

  def alias
    return unless allowed?(@org, 'edit')
    user = @org.attached_users('all').find_by_path(params['user_id'])
    return unless exists?(user, params['user_id'])
    # if !@org.settings['saml_metadata_url']
    #   return allowed?(@org, 'never_allowed')
    # end
    external_alias = params['alias']
    return api_error(400, {error: 'invalid alias'}) if external_alias.blank? || external_alias.length < 3
    return api_error(400, {error: 'org not configured for external auth'}) unless @org.settings['saml_metadata_url']
    res = @org.link_saml_alias(user, external_alias)
    if res
      render json: {linked: true, alias: external_alias, user_id: user.global_id}
    else
      api_error 400, {error: 'link failed'}
    end
  end

  def extra_action
    if !@org.admin
      return allowed?(@org, 'never_allowed')
    end
    return unless allowed?(@org, 'manage')
    success = false
    if params['extra_action'] == 'block_email'
      success = "found action"
      if params['email']
        success = "found email"
        Setting.block_email!(params['email'])        
        success = true
      end
    elsif params['extra_action'] == 'add_sentence_suggestion'
      success = false
      if params['word'] && params['sentence']
        success = WordData.add_suggestion(params['word'], params['sentence'], params['locale'])
      end
    end
    render json: {success: success}
  end
  
  def index
    admin_org = Organization.admin
    return unless allowed?(admin_org, 'edit')
    orgs = Organization.all.order(id: :desc)
    render json: JsonApi::Organization.paginate(params, orgs)
  end

  def create
    admin_org = Organization.admin
    return unless allowed?(admin_org, 'manage')
    org = Organization.process_new(params['organization'], {'updater' => @api_user})
    if org.errored?
      api_error(400, {error: "organization creation failed", errors: org && org.processing_errors})
    else
      render json: JsonApi::Organization.as_json(org, :wrapper => true, :permissions => @api_user).to_json
    end
  end

  def update
    org = Organization.find_by_global_id(params['id'])
    return unless exists?(org, params['id'])
    return unless allowed?(org, 'edit')
    if params['organization'] && !org.allows?(@api_user, 'update_licenses')
      params['organization'].delete('allotted_licenses') 
      params['organization'].delete('licenses_expire') 
      params['organization'].delete('include_extras')
      params['organization'].delete('org_access')
      params['organization'].delete('inactivity_timeout')
      params['organization'].delete('premium')
    end
    if org.process(params['organization'], {'updater' => @api_user})
      render json: JsonApi::Organization.as_json(org, :wrapper => true, :permissions => @api_user).to_json
    else
      api_error(400, {error: "organization update failed", errors: org.processing_errors})
    end
  end
  
  def destroy
    org = Organization.find_by_global_id(params['id'])
    return unless exists?(org, params['id'])
    return unless allowed?(org, 'delete')
    org.destroy
    render json: JsonApi::Organization.as_json(org, :wrapper => true, :permissions => @api_user).to_json
  end
end
