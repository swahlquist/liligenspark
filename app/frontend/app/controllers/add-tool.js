import Ember from 'ember';
import modal from '../utils/modal';
import Utils from '../utils/misc';
import CoughDrop from '../app';

export default modal.ModalController.extend({
  opening: function() {
    var _this = this;
    _this.set('tools', {loading: true});
    Utils.all_pages('integration', {template: true}, function(partial) {
    }).then(function(res) {
      _this.set('tools', res);
    }, function(err) {
      _this.set('tools', {error: true});
    });
  },
  actions: {
    install: function() {
      modal.close({added: true});
    },
    select_tool: function(tool) {
      tool.set('installing', null);
      tool.set('error', null);
      this.set('selected_tool', tool);
    },
    browse: function() {
      this.set('selected_tool', null);
    }
  }
});
