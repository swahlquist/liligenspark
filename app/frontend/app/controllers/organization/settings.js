import Controller from '@ember/controller';
import modal from '../../utils/modal';
import { computed } from '@ember/object';

export default Controller.extend({
  opening: function() {
    var _this = this;
    _this.set('status', null);
    if(_this.get('model.saml_metadata_url')) {
      _this.set('external_auth', true);
    }
    _this.set('allow_support_target', !!_this.get('model.support_target'));
    _this.set('support_email', _this.get('model.support_target.email'));
  },
  no_communicator_profile: computed('model.communicator_profile_id', function() {
    var id = this.get('model.communicator_profile_id');
    return !!(id == 'none' || id == '' || !id);
  }),
  no_supervisor_profile: computed('model.supervisor_profile_id', function() {
    var id = this.get('model.supervisor_profile_id');
    return !!(id == 'none' || id == '' || !id);
  }),
  actions: {
    cancel: function() {
      this.transitionToRoute('organization', this.get('model.id'));
    },
    save: function() {
      var _this = this;
      if(!_this.get('external_auth')) {
        _this.set('model.saml_metadata_url', null);
        _this.set('model.saml_sso_url', null);
      }
      _this.set('model.support_target', null);
      if(_this.get('allow_support_target') && _this.get('support_email')) {
        _this.set('model.support_target', {email: _this.get('support_email')})
      }
      var org = _this.get('model');
      _this.set('status', {saving: true});
      org.save().then(function() {
        _this.set('status', null);
        _this.transitionToRoute('organization', _this.get('model.id'));
      }, function() {
        _this.set('status', {error: true});
      });
    }
  }
});
