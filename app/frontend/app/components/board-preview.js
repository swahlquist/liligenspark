import Component from '@ember/component';
import CoughDrop from '../app';
import modal from '../utils/modal';
import app_state from '../utils/app_state';
import i18n from '../utils/i18n';
import { computed } from '@ember/object';

export default Component.extend({
  willInsertElement: function() {
    this.set('include_canvas', window.outerWidth > 800);
    this.set('model', {loading: true});
    var _this = this;
    if(_this.get('key')) {
      CoughDrop.store.findRecord('board', _this.get('key')).then(function(board) {
        if(!board.get('permissions')) {
          board.reload(false).then(function(board) {
            _this.set('model', board);
          });
        } else {
          _this.set('model', board);
        }
      }, function(err) {
        _this.set('model', {error: true});
      });
    }
  },
  multiple_locales: computed('model.locales', function() {
    return (this.get('model.locales') || []).length > 1;
  }),
  languages: computed('model.locales', function() {
    return (this.get('model.locales') || []).map(function(l) { return i18n.readable_language(l); }).join(', ');
  }),
  language: computed('model.locale', function() {
    return i18n.readable_language(this.get('model.locale'));
  }),
  select_option: computed('option', function() {
    return this.get('option') == 'select';
  }),
  actions: {
    select: function() {
      this.sendAction();
    },
    close: function() {
      modal.close_board_preview();
    },
    visit: function() {
      app_state.set('referenced_board', {id: this.get('model.id'), key: this.get('model.key'), locale: this.get('locale')});
      app_state.controller.transitionToRoute('board', this.get('model.key'));
    }
  }
});
