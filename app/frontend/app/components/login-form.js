import Ember from 'ember';
import Component from '@ember/component';
import { later as runLater } from '@ember/runloop';
import $ from 'jquery';
import capabilities from '../utils/capabilities';
import stashes from '../utils/_stashes';
import persistence from '../utils/persistence';
import i18n from '../utils/i18n';
import app_state from '../utils/app_state';
import session from '../utils/session';
import { isEmpty } from '@ember/utils';
import CoughDrop from '../app';
import { htmlSafe } from '@ember/string';
import { observer } from '@ember/object';

export default Component.extend({
  willInsertElement: function() {
    var _this = this;
    this.set('stashes', stashes);
    this.set('checking_for_secret', false);
    this.set('login_followup', null);
    this.browserTokenChange = function() {
      _this.set('client_id', 'browser');
      _this.set('client_secret', persistence.get('browserToken'));
      _this.set('checking_for_secret', false);
    };
    persistence.addObserver('browserToken', this.browserTokenChange);
    this.set('long_token', false);
    var token = persistence.get('browserToken');
    if(token) {
      this.set('client_id', 'browser');
      this.set('client_secret', token);
    } else {
      this.set('checking_for_secret', true);
      var timeout = this.get('restore') === false ? 100 : 2000;
      runLater(function() {
        _this.check_for_missing_token();
      }, timeout);
      if(this.get('restore') !== false) {
        session.restore(true);
      }
    }
    if(this.get('set_overflow')) {
      $("html,body").css('overflow', 'hidden');
    }
  },
  check_for_missing_token: function() {
    var _this = this;
    _this.set('checking_for_secret', false);
    if(!_this.get('client_secret')) {
      _this.set('requesting', true);
      session.check_token().then(function() {
        _this.set('requesting', false);
        runLater(function() {
          _this.check_for_missing_token();
        }, 2000);
      }, function() {
        _this.set('requesting', false);
        runLater(function() {
          _this.check_for_missing_token();
        }, 2000);
      });
    }
  },
  box_class: function() {
    if(this.get('wide')) {
      return htmlSafe('col-md-8 col-md-offset-2 col-sm-offset-1 col-sm-10');
    } else if(this.get('left')) {
      return htmlSafe('col-md-4 col-sm-6');
    } else {
      return htmlSafe('col-md-offset-4 col-md-4 col-sm-offset-3 col-sm-6');
    }
  }.property('left', 'wide'),
  app_state: function() {
    return app_state;
  }.property(),
  persistence: function() {
    return persistence;
  }.property(),
  willDestroyElement: function() {
    persistence.removeObserver('browserToken', this.browserTokenChange);
  },
  browserless: function() {
    return capabilities.browserless;
  }.property(),
  noSubmit: function() {
    return this.get('noSecret') || this.get('logging_in') || this.get('logged_in') || this.get('login_followup');
  }.property('logging_in', 'logged_in', 'noSecret'),
  noSecret: function() {
    return !this.get('client_secret');
  }.property('client_secret'),
  actions: {
    login_success: function(reload) {
      var _this = this;
      if(reload) {
        if(window.navigator.splashscreen) {
          window.navigator.splashscreen.show();
        }
      }
      var wait = stashes.flush(null, 'auth_').then(function() {
        stashes.setup();
      });
      var auth_settings = stashes.get_object('auth_settings', true) || {};
      capabilities.access_token = auth_settings.access_token;
      _this.set('logging_in', false);
      _this.set('login_followup', false);
      _this.set('logged_in', true);
      if(reload) {
        if(Ember.testing) {
          console.error("would have redirected to home");
        } else {
          wait.then(function() {
            if(_this.get('return')) {
              location.reload();
              session.set('return', true);
            } else if(capabilities.installed_app) {
              location.href = '#/';
              location.reload();
            } else {
              location.href = '/';
            }
          });
        }
      }
    },
    login_followup: function(choice) {
      var _this = this;
      CoughDrop.store.findRecord('user', 'self').then(function(u) {
        u.set('preferences.device.long_token', !!choice);
        u.save().then(function() {
          _this.send('login_success', true);
        }, function(err) {
          _this.set('login_followup', false);
          _this.set('logging_in', false);
          _this.set('login_error', i18n.t('user_update_failed', "Updating login preferences failed"));
        });
      }, function(err) {
        _this.set('login_followup', false);
        _this.set('logging_in', false);
        _this.set('login_error', i18n.t('user_update_failed', "Retrieving login preferences failed"));
      });
    },
    logout: function() {
      session.invalidate(true);
    },
    authenticate: function() {
      this.set('logging_in', true);
      this.set('login_error', null);
      var data = this.getProperties('identification', 'password', 'client_secret', 'long_token', 'browserless');
      if(capabilities.browserless || capabilities.installed_app) {
        data.long_token = true;
        data.browserless = true;
      }
      if (!isEmpty(data.identification) && !isEmpty(data.password)) {
        this.set('password', null);
        var _this = this;
        _this.set('login_followup_already_long_token', false);
        session.authenticate(data).then(function(data) {
          if(!data.long_token) {
            // follow-up question, is this a shared device?
            _this.send('login_success', false);
            _this.set('login_followup', true);
            _this.set('login_followup_already_long_token', data.long_token_set);
          } else {
            _this.send('login_success', true);
          }
        }, function(err) {
          err = err || {};
          _this.set('logging_in', false);
          if(err.error == "Invalid authentication attempt") {
            _this.set('login_error', i18n.t('invalid_login', "Invalid user name or password"));
          } else if(err.error == "Invalid client secret") {
            _this.set('login_error', i18n.t('invalid_login', "Your login token is expired, please try again"));
          } else if(err.error && err.error.match(/user name was changed/i) && err.user_name) {
            _this.set('login_error', i18n.t('user_name_changed', "NOTE: User name has changed to \"%{un}\"", {un: err.user_name}));
          } else {
            _this.set('login_error', i18n.t('login_error', "There was an unexpected problem logging in"));
          }
        });
      } else {
        this.set('login_error', i18n.t('login_required', "Username and password are both required"));
        this.set('logging_in', false);
      }
    }
  }
});
