class Api::ImagesController < ApplicationController
  include RemoteUploader
  before_action :require_api_token, :except => [:upload_success]
  
  def create
    # TODO: search for an existing record with the exact same settings first
    image = ButtonImage.process_new(params['image'], {:user => @api_user, :remote_upload_possible => true})
    if !image || image.errored?
      api_error(400, {error: "image creation failed", errors: image && image.processing_errors})
    else
      render json: JsonApi::Image.as_json(image, :wrapper => true, :permissions => @api_user).to_json
    end
  end
  
  def show
    image = ButtonImage.find_by_path(params['id'])
    image = nil if params['id'].match(/^tmpimg/)
    return unless exists?(image)
    return unless allowed?(image, 'view')
    render json: JsonApi::Image.as_json(image, :wrapper => true, :permissions => @api_user).to_json
  end
  
  def update
    image = ButtonImage.find_by_path(params['id'])
    return unless exists?(image)
    return unless allowed?(image, 'view')
    if image.process(params['image'])
      render json: JsonApi::Image.as_json(image, :wrapper => true, :permissions => @api_user).to_json
    else
      api_error(400, {error: "image update failed", errors: image.processing_errors})
    end
  end
end