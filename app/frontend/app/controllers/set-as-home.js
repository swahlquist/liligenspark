import Ember from 'ember';
import modal from '../utils/modal';
import app_state from '../utils/app_state';
import persistence from '../utils/persistence';
import CoughDrop from '../app';

export default modal.ModalController.extend({
  opening: function() {
    var supervisees = [];
    if(app_state.get('sessionUser.supervisees')) {
      app_state.get('sessionUser.supervisees').forEach(function(supervisee) {
        var res = Ember.Object.create(supervisee);
        res.set('disabled', !supervisee.edit_permission);
        supervisees.push(res);
      });
    }
    this.set('model.supervisees', supervisees);
  },
  actions: {
    select: function(for_user_id) {
      var _this = this;
      var board = this.get('model.board');

      CoughDrop.store.findRecord('user', for_user_id).then(function(user) {
        user.set('preferences.home_board', {
          id: board.get('id'),
          key: board.get('key')
        });
        var _this = this;
        user.save().then(function() {
          modal.close();
          if(persistence.get('online')) {
            Ember.run.later(function() {
              console.debug('syncing because set as home');
              persistence.sync('self').then(null, function() { });
            }, 1000);
          }
        }, function() { });
      }, function() {
        _this.set('errored', true);
      });
    }
  }
});
