class AdminConstraint
  def matches?(request)
    if request.cookies['admin_token']
      user_id = Permissable.permissions_redis.get('/admin/auth/' + request.cookies['admin_token'])
    end
    if user_id
      user = User.find_by_global_id(user_id)
      return user && user.admin?
    end
    return false
  end
end
