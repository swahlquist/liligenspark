class Api::LessonsController < ApplicationController
  before_action :require_api_token, :except => [:index, :show]
  def index
    lessons = Lesson.all
    if params['organization_id']
      org = Organization.find_by_path(params['organization_id'])
      return unless exists?(org, params['organization_id'])
      return unless authorized?(org, 'manage')
      lessons = lessons.where(organization_id: org.id)
    elsif params['organization_unit_id']
      unit = OrganizationUnit.find_by_path(params['organization_unit_id'])
      return unless exists?(unit, params['organization_unit_id'])
      return unless authorized?(unit, 'edit')
      lessons = lessons.where(organization_unit_id: unit.id)
    else
      lessons = lessons.where(public: true)
    end
    if params['active']
    elsif params['concluded']
    end
    render json: JsonApi::Organization.paginate(params, lessons)
  end

  def show
    lesson = Lesson.find_by_path(params['id'])
    return unless exists?(lesson, params['id'])
    return unless authorized?(lesson, 'view')
    render json: JsonApi::Lesson.as_json(lesson, {wrapper: true, permissions: @api_user})
  end

  def update
    lesson = Lesson.find_by_path(params['lesson_id'])
    return unless exists?(lesson, params['lesson_id'])
    return unless authorized?(lesson, 'edit')
    render json: JsonApi::Lesson.as_json(lesson, {wrapper: true, permissions: @api_user})
  end

  def assign
    lesson = Lesson.find_by_path(params['id'])
    return unless exists?(lesson, params['id'])
    return unless authorized?(lesson, 'view')
    if params['user_id']
      user = User.find_by_path(params['user_id'])
      return unless exists?(user, params['user_id'])
      return unless authorized?(user, 'supervise')
      Lesson.assign(lesson, user, @api_user)
    elsif params['organization_id']
      org = Organization.find_by_path(params['organization_id'])
      return unless exists?(org, params['organization_id'])
      return unless authorized?(org, 'manage')
      Lesson.assign(lesson, org, @api_user)
    elsif params['organization_unit_id']
      unit = OrganizationUnit.find_by_path(params['organization_unit_id'])
      return unless exists?(unit, params['organization_unit_id'])
      return unless authorized?(unit, 'edit')
      Lesson.assign(lesson, unit, @api_user)
    end
    render json: JsonApi::Lesson.as_json(lesson, {wrapper: true, permissions: @api_user})
  end

  def destroy
    lesson = Lesson.find_by_path(params['lesson_id'])
    return unless exists?(lesson, params['lesson_id'])
    return unless authorized?(lesson, 'delete')
    render json: JsonApi::Lesson.as_json(lesson, {wrapper: true, permissions: @api_user})
  end
end
