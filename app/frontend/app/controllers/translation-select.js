import modal from '../utils/modal';
import BoardHierarchy from '../utils/board_hierarchy';
import i18n from '../utils/i18n';
import app_state from '../utils/app_state';
import editManager from '../utils/edit_manager';
import { computed } from '@ember/object';

export default modal.ModalController.extend({
  opening: function() {
    var _this = this;
    _this.set('default_language', true);
    _this.set('hierarchy', {loading: true});
    BoardHierarchy.load_with_button_set(this.get('model.board'), {deselect_on_different: true, prevent_different: true}).then(function(hierarchy) {
      _this.set('hierarchy', hierarchy);
    }, function(err) {
      _this.set('hierarchy', {error: true});
    });
  },
  locales: computed(function() {
    var list = i18n.get('translatable_locales');
    var res = [{name: i18n.t('choose_locale', '[Choose a Language]'), id: ''}];
    for(var key in list) {

      res.push({name: list[key], id: key});
    }
    res.push({name: i18n.t('unspecified', "Unspecified"), id: ''});
    return res;
  }),
  actions: {
    translate: function() {
      var _this = this;
      var board_ids_to_include = null;
      if(this.get('hierarchy') && this.get('hierarchy').selected_board_ids) {
        board_ids_to_include = this.get('hierarchy').selected_board_ids();
      }

      var translate_opts = {
        board: _this.get('model.board'),
        copy: _this.get('model.board'),
        button_set: _this.get('model.board.button_set'),
        locale: _this.get('translate_locale'),
        default_language: _this.get('default_language'),
        old_board_ids_to_translate: board_ids_to_include,
        new_board_ids_to_translate: board_ids_to_include
      };

      return modal.open('button-set', translate_opts).then(function(res) {
        if(res && res.translated) {
          return _this.get('model.board').reload(true).then(function() {
            if(translate_opts.default_language && app_state.get('currentBoardState.id') == _this.get('model.board.id')) {
              app_state.set('currentBoardState.default_locale', _this.get('model.board.locale'));
              app_state.set('label_locale', _this.get('model.board.locale'));
              app_state.set('vocalization_locale', _this.get('model.board.locale'));
            }
            app_state.set('board_reload_key', Math.random() + "-" + (new Date()).getTime());
          });
        }
      });
    },
  }
});
