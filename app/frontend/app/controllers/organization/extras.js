import Ember from 'ember';
import persistence from '../../utils/persistence';
import modal from '../../utils/modal';
import i18n from '../../utils/i18n';

export default Ember.Controller.extend({
  refresh_lists: function() {
    this.load_blocked_emails();
  },
  load_blocked_emails: function() {
    var _this = this;
    _this.set('blocked_emails', {loading: true});
    persistence.ajax('/api/v1/organizations/' + this.get('model.id') + '/blocked_emails', {type: 'GET'}).then(function(res) {
      _this.set('blocked_emails', res.emails);
    }, function(err) {
      _this.set('blocked_emails', {error: true});
    });
  },
  actions: {
    block_email: function() {
      var email = this.get('blocked_email_address');
      var _this = this;
      if(email) {
        persistence.ajax('/api/v1/organizations/' + this.get('model.id') + '/extra_action', {
          type: 'POST',
          data: {
            extra_action: 'block_email',
            email: email
          }
        }).then(function(res) {
          if(res.success === false) {
            modal.error(i18n.t('blocking_email_failed', "Email address was not blocked"));
          } else {
            _this.set('blocked_email_address', null);
            _this.load_blocked_emails();
          }
        }, function(err) {
          modal.error(i18n.t('error_blocking_email', "There was an unexpected error while trying to add the blocked email address"));
        });
      }
    }
  }
});
