import CoughDrop from '../app';
import app_state from '../utils/app_state';
import modal from '../utils/modal';

export default modal.ModalController.extend({
  opening: function() {
    var unit = this.get('model.unit');
    this.set('unit', unit);
    this.set('error', false);
    this.set('saving', false);
  },
  actions: {
    close: function() {
      modal.close(false);
    },
    save: function() {
      var _this = this;
      var unit = _this.get('model.unit');
      _this.set('error', false);
      _this.set('saving', true);
      unit.save().then(function() {
        modal.close({updated: true});
        _this.set('saving', false);
      }, function() {
        _this.set('error', true);
        _this.set('saving', false);
      });
    }
  }
});
