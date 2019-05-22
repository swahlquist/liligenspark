class Api::WordsController < ApplicationController
  before_action :require_api_token
  
  def index
    return unless allowed?(@api_user, 'admin_support_actions')
    words = WordData.where(locale: params['locale']).where(['priority > ?', 0])
    words = words.order('reviews ASC, priority DESC, word')
    render json: JsonApi::Word.paginate(params, words)
  end
  
  def update
    word = WordData.find_by_global_id(params['id'])
    return unless allowed?(@api_user, 'admin_support_actions')
    return unless exists?(word, params['id'])
    if word.process(params['word'], {updater: @api_user})
      render json: JsonApi::Word.as_json(word, {wrapper: true, permissions: @api_user})
    else
      api_error(400, {error: "word update failed", errors: word.processing_errors})
    end
  end
end
