import EmberObject from '@ember/object';
import CoughDrop from '../app';
import modal from '../utils/modal';
import app_state from '../utils/app_state';
import i18n from '../utils/i18n';
import { observer } from '@ember/object';

export default modal.ModalController.extend({
  opening: function() {
    this.set('model.jump_home', true);
    this.set('model.keep_as_self', false);
    this.set('board_name', this.get('model.board.name'));
    var user_name = this.get('model.selected_user_name');
    var supervisees = [];
    if(app_state.get('sessionUser.supervisees.length')) {
      var selected_user_id = null;
      app_state.get('sessionUser.known_supervisees').forEach(function(supervisee) {
        var res = EmberObject.create(supervisee);
        res.set('currently_speaking', app_state.get('currentUser.id') == supervisee.id);
        res.set('disabled', !supervisee.edit_permission);
        if(user_name && supervisee.user_name == user_name && supervisee.edit_permission) {
          selected_user_id = supervisee.id;
        }
        supervisees.push(res);
      });
      this.set('currently_selected_id', selected_user_id);
    } else {
      this.set('currently_selected_id', 'self');
    }
    this.set('model.known_supervisees', supervisees);
  },
  linked: function() {
    return (this.get('model.board.linked_boards') || []).length > 0;
  }.property('model.board.buttons'),
  locales: function() {
    var list = i18n.get('translatable_locales');
    var res = [{name: i18n.t('choose_locale', '[Choose a Language]'), id: ''}];
    for(var key in list) {
      res.push({name: list[key], id: key});
    }
    res.push({name: i18n.t('unspecified', "Unspecified"), id: ''});
    return res;
  }.property(),
  user_board: observer('currently_selected_id', 'model.known_supervisees', function() {
    var for_user_id = this.get('currently_selected_id');
    this.set('self_currently_selected', for_user_id == 'self');
    if(this.get('model.known_supervisees')) {
      this.get('model.known_supervisees').forEach(function(sup) {
        if(for_user_id == sup.id) {
          sup.set('currently_selected', true);
        } else {
          sup.set('currently_selected', false);
        }
      });
    }
    if(for_user_id) {
      var _this = this;
      this.set('loading', true);
      this.set('error', false);
      this.set('current_user', null);
      this.set('in_board_set', null);
      this.set('in_sidebar_set', null);
      this.set('home_board', null);
      var find_user = CoughDrop.store.findRecord('user', for_user_id).then(function(user) {
        if(!user.get('stats')) {
          return user.reload();
        } else {
          return user;
        }
      });
      find_user.then(function(user) {
        var in_board_set = (user.get('stats.board_set_ids') || []).indexOf(_this.get('model.board.id')) >= 0;
        _this.set('current_user', user);
        _this.set('loading', false);
        _this.set('in_board_set', !!in_board_set);
        var sidebar_keys = (user.get('preferences.sidebar_boards') || []).map(function(b) { return b.key; });
        if(!in_board_set) {
          // load all the sidebar button sets and see if it is
          // in any of their board_ids lists
          sidebar_keys.forEach(function(key) {
            if(!key) { return; }
            CoughDrop.store.findRecord('board', key).then(function(board) {
              if(_this.get('current_user') == user) {
                if(board.get('key') == _this.get('model.board.key')) {
                  _this.set('in_sidebar_set', true);
                  var sidebar_ids = user.get('stats.sidebar_board_ids') || [];
                  user.set('stats.sidebar_board_ids', sidebar_ids.concat([board.get('id')]).uniq());
                }
              }
              CoughDrop.Buttonset.load_button_set(board.get('id')).then(function(bs) {
                var board_ids = bs.board_ids_for(board.get('id'));
                if(_this.get('current_user') == user) {
                  var sidebar_ids = user.get('stats.sidebar_board_ids') || [];
                  user.set('stats.sidebar_board_ids', sidebar_ids.concat(board_ids).uniq());
                  if(board_ids.indexOf(_this.get('model.board.id')) >= 0) {
                    _this.set('in_sidebar_set', true);
                  }
                }
              }, function() { });
            }, function() { });
          });
        }
        _this.set('home_board', user.get('preferences.home_board.id') == _this.get('model.board.id'));
      }, function() {
        _this.set('loading', false);
        _this.set('error', true);
      });
    } else {
      this.set('loading', false);
      this.set('error', false);
      this.set('in_board_set', false);
      this.set('in_sidebar_set', false);
      this.set('home_board', false);
    }
  }),
  actions: {
    tweakBoard: function(decision) {
      if(this.get('model.known_supervisees').length > 0) {
        if(!this.get('currently_selected_id')) {
          return;
        }
      }
      var shares = [];

      if(this.get('self_currently_selected')) {
        (this.get('model.known_supervisees') || []).forEach(function(sup) {
          if(sup.share) {
            shares.push(sup);
          }
        });
      }
      var translate_locale = null;
      if(this.get('translate') && this.get('translate_locale')) {
        translate_locale = this.get('translate_locale');
      }
      modal.close({action: decision, user: this.get('current_user'), shares: shares, board_name: this.get('board_name'), make_public: this.get('public'), translate_locale: translate_locale});
    },
    close: function() {
      modal.close(false);
    }
  }
});
