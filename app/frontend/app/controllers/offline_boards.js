import Controller from '@ember/controller';
import modal from '../utils/modal';
import i18n from '../utils/i18n';
import obf from '../utils/obf';
import emergency from '../utils/obf-emergency';
import persistence from '../utils/persistence';
import CoughDrop from '../app';
import { later as runLater } from '@ember/runloop';
import { computed, observer } from '@ember/object';

export default Controller.extend({
  preferred_locale: computed('last_locale', function() {
    if(this.get('last_locale')) { return this.get('last_locale'); }
    return navigator.language.toLowerCase().split(/-|_/)[0];
  }),
  locales: computed(function() {
    var res = [];
    var pref = this.get('preferred_locale');
    var locs = i18n.locales;
    for(var key in emergency.boards) {
      var starters = (emergency.boards[key] || []).filter(function(b) { return b.starter; });
      res.push({
        locale: key,
        open: pref == key,
        boards: starters,
        tally: i18n.t('n_boards', "board", {count: starters.length}),
        locale_text: locs[key] || key,
        icon_class: "glyphicon glyphicon-globe"
      });
    }
    return res;
  }),
  toggle_locale: observer('preferred_locale', function() {

  }),
  actions: {
  }
});
