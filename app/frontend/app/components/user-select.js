import Component from '@ember/component';
import EmberObject from '@ember/object';
import app_state from '../utils/app_state';
import i18n from '../utils/i18n';
import { set as emberSet, get as emberGet } from '@ember/object';
import { observer } from '@ember/object';
import { computed } from '@ember/object';
import persistence from '../utils/persistence';

export default Component.extend({
  tagName: 'span',
  action: function() { return this; },
  didInsertElement: function() {
    var supervisees = [];
    var _this = this;
    if(!this.get('users') && app_state.get('sessionUser.known_supervisees')) {
      app_state.get('sessionUser.known_supervisees').forEach(function(supervisee) {
        var sup = {
          name: supervisee.user_name,
          image: supervisee.local_avatar_url || supervisee.avatar_url,
          disabled: !_this.get('allow_all') && !supervisee.edit_permission,
          id: supervisee.id
        };
        supervisees.push(sup);
        if(supervisee.avatar_url && !supervisee.local_avatar_url) {
          persistence.find_url(supervisee.avatar_url, 'image').then(function(url) {
            emberSet(supervisee, 'local_avatar_url', url);
            emberSet(sup, 'image', url);
          }, function(err) { });
        }
      });
      if(supervisees.length > 0) {
        supervisees.unshift({
          name: i18n.t('me', "me"),
          id: 'self',
          disabled: this.get('skip_me'),
          self: true,
          image: app_state.get('sessionUser.avatar_url_with_fallback')
        });
      }
      if(!this.get('buttons') && !this.get('selection')) {
        this.sendAction('action', 'self');
      }
    }
    if(!app_state.get('sessionUser.supervisees') || supervisees.length === 0) {
      this.sendAction('action', 'self');
    }
    this.set('users', this.get('users') || supervisees);
  },
  include_me: observer('skip_me', function() {
    var self = (this.get('users') || []).find(function(u) { return u.id == 'self'; });
    if(self) {
      emberSet(self, 'disabled', !!this.get('skip_me'));
    }
  }),
  for_user_image: computed('users', 'selection', function() {
    var res = null;
    var user_id = this.get('selection');
    (this.get('users') || []).forEach(function(sup) {
      if(sup.id == user_id) {
        res = sup.image;
      }
    });
    return res;
  }),
  actions: {
    select: function(id) {
      var found = false;
      (this.get('users') || []).forEach(function(sup) {
        if(sup.id == id) {
          emberSet(sup, 'currently_selected', true);
          found = true;
        } else {
          emberSet(sup, 'currently_selected', false);
        }
      });
      if(found) {
        this.sendAction('action', id);
      }
    }
  }
});
