import modal from '../../utils/modal';
import i18n from '../../utils/i18n';
import persistence from '../../utils/persistence';
import session from '../../utils/session';
import { later as runLater } from '@ember/runloop';
import { computed, observer } from '@ember/object';

export default modal.ModalController.extend({
  opening: function() {

  },
  set_home_board: computed('model.action', function() {
    return this.get('model.action') == 'add_home';
  }),
  set_default_home_board_template: observer('model.action', 'model.org', 'home_board_template', function() {
    if(this.get('board_options') && !this.get('home_board_template')) {
      this.set('home_board_template', this.get('board_options')[0].id);
    }
  }),
  board_options: computed('model.action', 'model.org', function() {
    if(this.get('model.action') != 'add_home') { 
      return null;
    }
    var res = [];
    (this.get('model.org.home_board_keys') || []).forEach(function(key) {
      res.push({
        name: i18n.t('copy_of_key', "Copy of %{key}", {key: key}),
        id: key
      })
    });
    res.push({
      name: i18n.t('no_board_now', "[ Don't Set a Home Board Now ]"),
      id: 'none'
    })
    return res;
  }),
  actions: {
    confirm: function() {
      if(this.get('set_home_board')) {
        modal.close({confirmed: true, home: this.get('home_board_template'), symbols: this.get('home_board_symbols')});
      } else if(this.get('confirmed') == 'confirmed' || this.get('model.user_name') || this.get('model.unit_user_name')) {
        modal.close({confirmed: true});
      }
    }
  }
});
