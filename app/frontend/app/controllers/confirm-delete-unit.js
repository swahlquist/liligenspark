import modal from '../utils/modal';

export default modal.ModalController.extend({
  actions: {
    deleteUnit: function() {
      var _this = this;
      var unit = this.get('model.unit');
      unit.deleteRecord();
      _this.set('model.deleting', true);
      unit.save().then(function(res) {
        modal.close({deleted: true});
      }, function() {
        _this.set('model.deleting', false);
        _this.set('model.error', true);
      });
    }
  }
});
