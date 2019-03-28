import Ember from 'ember';
import modal from '../utils/modal';
import i18n from '../utils/i18n';
import app_state from '../utils/app_state';
import coughDropExtras from '../utils/extras';

export default modal.ModalController.extend({
  opening: function() {
    var controller = this;
    var board = controller.get('model.board');
    controller.set('model', {});
    controller.set('board', board);
    this.set('confirm_public_board', false);
    this.set('show_embed', false);
    this.set('error_confirming_public_board', false);
  },
  supervisee_share: function() {
    var un = this.get('share_user_name');
    return un && (app_state.get('currentUser.known_supervisees') || []).find(function(s) { return s.user_name == un; });
  }.property('share_user_name', 'app_state.currentUser.known_supervisees'),
  not_copyable: function() {
    var un = this.get('share_user_name');
    return !(un && (app_state.get('currentUser.known_supervisees') || []).find(function(s) { return s.user_name == un && s.edit_permission; }));
  }.property('share_user_name', 'app_state.currentUser.known_supervisees'),
  actions: {
    share_with_user: function() {
      var user_name = this.get('share_user_name');
      var include_downstream = this.get('share_include_downstream');
      var allow_editing = this.get('share_allow_editing');
      var sharing_key = "add_shallow-" + user_name;
      if(allow_editing) {
        sharing_key = "add_edit_shallow-" + user_name;
        if(include_downstream) {
          sharing_key = "add_edit_deep-" + user_name;
        }
      } else {
        if(include_downstream) {
          sharing_key = "add_deep-" + user_name;
        }
      }
      var board = this.get('board');
      board.set('sharing_key', sharing_key);
      board.save().then(function() {
      }, function(xhr) {
        console.log(xhr.responseJSON);
        modal.error(i18n.t('sharing_failed', "Board sharing action failed"));
      });
    },
    unshare: function(id) {
      var sharing_key = "remove-" + id;
      var board = this.get('board');
      board.set('sharing_key', sharing_key);
      board.save().then(function() {
      }, function(xhr) {
        console.log(xhr.responseJSON);
        modal.error(i18n.t('unsharing_failed', "Board unsharing action failed"));
      });
    },
    make_public: function(action) {
      if(action == 'confirm') {
        var board = this.get('board');
        board.set('public', true);
        var _this = this;
        board.save().then(function() {
          _this.set('confirm_public_board', false);
        }, function() {
          _this.set('confirm_public_board', false);
          _this.set('error_confirming_public_board', true);
          board.set('public', false);
        });
      } else if(action == 'cancel') {
        this.set('confirm_public_board', false);
      } else {
        this.set('confirm_public_board', true);
      }
    },
    copy_event(res) {
      if(res) {
        this.set('copy_result', {succeeded: true});
      } else {
        this.set('copy_result', {failed: true});
      }
    },
    copy_board: function() {
      app_state.controller.copy_board(null, null, this.get('share_user_name'));
    },
    set_share_user_name: function(user_name) {
      this.set('share_user_name', user_name);
    },
    show_embed_board: function() {
      this.set('show_embed', !this.get('show_embed'));
    }
  }
});
