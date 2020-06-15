import modal from '../../utils/modal';
import i18n from '../../utils/i18n';
import { later as runLater } from '@ember/runloop';
import persistence from '../../utils/persistence';
import session from '../../utils/session';
import progress_tracker from '../../utils/progress_tracker';

export default modal.ModalController.extend({
  opening: function() {
    this.set('user', this.get('model.user'));
    var choice = {};
    choice[this.get('modal.action')] = true;
    this.set('choice', choice);
    this.set('extend_date', window.moment(this.get('user.subscription.eval_expires')).add(7, 'day').toISOString().substring(0, 10));
    var days = this.get('user.preferences.eval.duration') || 90;
    this.set('eval_expires', window.moment().add(days, 'day').toISOString().substring(0, 10));
    if(this.get('user')) {
      this.get('user').reload();
    }
  },
  actions: {
    choose: function(action) {
      var choice = {};
      choice[action] = true;
      this.set('choice', choice);
    },
    transfer: function() {
      var _this = this;
      if(_this.get('permissions.delete') && _this.get('transfer_user_name') && _this.get('transfer_password')) {
        // requires target username and password
        _this.set('status', {transferring: true});
        // api/v1/users/id/evals/transfer
        persistence.ajax('/api/v1/users/' + _this.get('user.id') + '/evals/transfer', {
          type: 'POST',
          data: {
            user_name: _this.get('transfer_user_name'),
            password: _this.get('transfer_password')
          }
        }).then(function(res) {
          progress_tracker.track(res.progress, function(event) {
            if(event.status == 'errored') {
              _this.set('status', {transfer_error: true});
            } else if(event.status == 'finished') {
              _this.set('status', {transfer_finished: true});
              runLater(function() {
                // log out
                session.invalidate(true);
                // TODO: auto-log-in as the other user?
              }, 2000);
            }
          });
        }, function(error) {
          if(error && error.error == 'invalid_credentials') {
            _this.set('status', {transfer_bad_credentials: true});
          } else {
            _this.set('status', {transfer_error: true});

          }
       });
      }
    },
    reset: function() {
      var _this = this;
      if(_this.get('user.can_reset_eval')) {
        if(_this.get('user.email') == _this.get('reset_email')) {
          _this.set('status', {reset_email_used: true});
        } else if(_this.get('user.user_name') != _this.get('reset_user_name')) {
          return
        } else {
          _this.set('status', {resetting: true});
          persistence.ajax('/api/v1/users/' + _this.get('user.id') + '/evals/reset', {
            type: 'POST',
            data: {
              expires: _this.get('eval_expires'),
              password: _this.set('reset_password'),
              email: _this.get('reset_email')
            }
          }).then(function(res) {
            progress_tracker.track(res.progress, function(event) {
              if(event.status == 'errored') {
                _this.set('status', {reset_error: true});
              } else if(event.status == 'finished') {
                _this.set('status', {reset_finished: true});
                runLater(function() {
                  location.reload();
                }, 2000);
              }
            });
          }, function(error) {
            _this.set('status', {reset_error: true});
          });
          // api/v1/users/id/evals/reset
          // ask for some kind of required information
          // to make it just a little harder to reset
          // if you're using this to cheat the system
          // eval end date, email address
          // TODO: send out a welcome email when eval starts???
        }
      }
    },
    extend: function() {
      var _this = this;
      if(this.get('user.subscription.eval_extendable') || this.get('user.can_reset_eval')) {
        _this.set('status', {extending: true});
        var user = this.get('user');
        var date = this.get('extend_date');
        user.set('preferences.extend_eval', date || true);
        user.save().then(function() {
          if(!user.get('eval_expiring')) {
            modal.close();
            modal.success(i18n.t('eval_extended', "Evaluation Period Successfully Extended!"))
            // successs!
          } else {
            _this.set('status', {cant_extend: true});
            // didn't work
          }
        }, function() {
          _this.set('status', {extend_error: true});
          // API error
        });
      } else {
        _this.set('status', {cant_extend: true});
      }
    }
  }
});
