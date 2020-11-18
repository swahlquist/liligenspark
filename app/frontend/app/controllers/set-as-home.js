import { later as runLater } from '@ember/runloop';
import modal from '../utils/modal';
import app_state from '../utils/app_state';
import editManager from '../utils/edit_manager';
import persistence from '../utils/persistence';
import stashes from '../utils/_stashes';
import i18n from '../utils/i18n';
import CoughDrop from '../app';
import { computed } from '@ember/object';

export default modal.ModalController.extend({
  opening: function() {
    this.set('has_supervisees', app_state.get('sessionUser.supervisees.length') > 0);
    this.set('currently_selected_id', null);
    this.set('app_state', app_state);
    this.set('status', null);
    this.set('board_level', stashes.get('board_level'));
  },
  owned_by_user: computed('currently_selected_id', 'model.board.user_name', function() {
    var board_user_name = this.get('model.board.user_name');
    var user_name = 'nobody';
    var current_id = this.get('currently_selected_id');
    if(current_id == 'self') {
      user_name = app_state.get('sessionUser.user_name');
    } else if(current_id == app_state.get('sessionUser.user_id')) {
      user_name = app_state.get('sessionUser.user_name');
    } else {
      (app_state.get('sessionUser.known_supervisees') || []).forEach(function(sup) {
        if(sup.id == current_id) {
          user_name = sup.user_name;
        }
      });
    }
    return user_name == board_user_name;
  }),
  multiple_users: computed('has_supervisees', function() {
    return !!this.get('has_supervisees');
  }),
  board_levels: computed(function() {
    return [
      {name: i18n.t('unspecified', "[ Use the Default ]"), id: ''},
      {name: i18n.t('level_1', "Level 1 (most simple)"), id: '1'},
      {name: i18n.t('level_2', "Level 2"), id: '2'},
      {name: i18n.t('level_3', "Level 3"), id: '3'},
      {name: i18n.t('level_4', "Level 4"), id: '4'},
      {name: i18n.t('level_5', "Level 5"), id: '5'},
      {name: i18n.t('level_6', "Level 6"), id: '6'},
      {name: i18n.t('level_7', "Level 7"), id: '7'},
      {name: i18n.t('level_8', "Level 8"), id: '8'},
      {name: i18n.t('level_9', "Level 9"), id: '9'},
      {name: i18n.t('level_10', "Level 10 (all buttons and links)"), id: '10'},
    ];
  }),
  pending: computed('status.updating', 'status.copying', function() {
    return this.get('status.updating') || this.get('status.copying');
  }),
  actions: {
    copy_as_home: function() {
      var _this = this;
      var for_user_id = this.get('currently_selected_id') || 'self';
      _this.set('status', {copying: true});
      var board = _this.get('model.board');
      CoughDrop.store.findRecord('user', for_user_id).then(function(user) {
        editManager.copy_board(board, 'links_copy_as_home', user, false).then(function() {
          _this.send('done');
        }, function() {
          _this.set('status', {errored: true});
        });
      }, function() {
        _this.set('status', {errored: true});
      });
    },
    done: function() {
      var _this = this;
      _this.set('status', null);
      modal.close({updated: true});
    },
    set_as_home: function(for_user_id) {
      var for_user_id = this.get('currently_selected_id') || 'self';
      var _this = this;
      var board = this.get('model.board');
      _this.set('status', {updating: true});
      var level = parseInt(this.get('board_level'), 10);
      if(!level || level < 1 || level > 10) { level = null; }

      CoughDrop.store.findRecord('user', for_user_id).then(function(user) {
        user.set('preferences.home_board', {
          level: level,
          locale: app_state.get('label_locale'),
          id: board.get('id'),
          key: board.get('key')
        });
        user.save().then(function() {
          _this.send('done');
        }, function() {
          _this.set('status', {errored: true});
        });
      }, function() {
        _this.set('status', {errored: true});
      });
    }
  }
});
