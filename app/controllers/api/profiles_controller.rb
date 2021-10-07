class Api::ProfilesController < ApplicationController
  def latest
    user = User.find_by_path(params['user_id'])
    return unless exists?(user, params['user_id'])
    return unless allowed?(user, 'supervise')
    sessions = LogSession.where(user: user, profile_id: params['profile_id']).where('started_at IS NOT NULL').order('started_at DESC').limit(10)
    return unless exists?(session, params['profile_id'])
    list = sessions.map do |session|
      author = session.author
      {
        started: session.started_at,
        log_id: session.global_id,
        profile: session.data['profile'].except('results', 'encrypted_results'),
        author: {user_name: author.user_name, id: author.global_id}
      }
    end
    render json: list
  end
end
