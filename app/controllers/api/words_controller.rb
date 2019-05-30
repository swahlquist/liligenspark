class Api::WordsController < ApplicationController
  before_action :require_api_token
  
  def index
    return unless allowed?(@api_user, 'admin_support_actions')
    words = WordData.where(locale: params['locale']).where(['priority > ?', 0])
    if params['word']
      words = words.order(ActiveRecord::Base.send(:sanitize_sql_for_conditions, ['(word = ?) DESC, reviews ASC, priority DESC, word', params['word']]))
    else
      words = words.where(['updated_at < ?', 24.hours.ago]).order('reviews ASC, priority DESC, word')
    end
    render json: JsonApi::Word.paginate(params, words)
  end
  
  def update
    word = WordData.find_by_global_id(params['id'])
    return unless allowed?(@api_user, 'admin_support_actions')
    return unless exists?(word, params['id'])
    word_params = params['word']
    if params['word'] && params['word']['skip']
      word_params = word_params.slice('skip')
    end
    if word.process(params['word'], {updater: @api_user})
      render json: JsonApi::Word.as_json(word, {wrapper: true, permissions: @api_user})
    else
      api_error(400, {error: "word update failed", errors: word.processing_errors})
    end
  end
end
