import modal from '../utils/modal';
import RSVP from 'rsvp';
import BoardHierarchy from '../utils/board_hierarchy';
import { computed } from '@ember/object';

export default modal.ModalController.extend({
  opening: function() {
    if(this.get('model.board')) {
      this.get('model.board').reload();
      var _this = this;
      _this.set('hierarchy', {loading: true});
      BoardHierarchy.load_with_button_set(this.get('model.board'), {deselect_on_different: true, prevent_keyboard: true, prevent_different: true}).then(function(hierarchy) {
        _this.set('hierarchy', hierarchy);
      }, function(err) {
        _this.set('hierarchy', {error: true});
      });
    }
    this.set('delete_downstream', false);
  },
  using_user_names: computed('model.board.using_user_names', function() {
    return (this.get('model.board.using_user_names') || []).join(', ');
  }),
  actions: {
    deleteBoard: function(decision) {
      var _this = this;
      var board = this.get('model.board');
      board.deleteRecord();
      _this.set('model.deleting', true);
      var load_promises = [];
      var other_boards = [];
      if(this.get('delete_downstream')) {
        var other_board_ids = board.get('downstream_board_ids');
        if(this.get('hierarchy')) {
          other_board_ids = this.get('hierarchy').selected_board_ids();
        }
  
        other_board_ids.forEach(function(id) {
          load_promises.push(_this.store.findRecord('board', id).then(function(board) {
            other_boards.push(board);
          }));
        });
      }
      var save = board.save();

      var wait_for_loads = save.then(function() {
        return RSVP.all_wait(load_promises);
      });

      var delete_others = wait_for_loads.then(function() {
        var delete_promises = [];
        other_boards.forEach(function(b) {
          if(b.get('user_name') == board.get('user_name')) {
            b.deleteRecord();
            delete_promises.push(b.save());
          }
        });
        return RSVP.all_wait(delete_promises);
      });

      delete_others.then(function() {
        if(_this.get('model.redirect')) {
          _this.transitionToRoute('index');
        }
        modal.close({update: true});
      }, function() {
        _this.set('model.deleting', false);
        _this.set('model.error', true);
      });
    }
  }
});
