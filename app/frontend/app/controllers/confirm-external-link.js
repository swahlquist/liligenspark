import modal from '../utils/modal';
import capabilities from '../utils/capabilities';

export default modal.ModalController.extend({
  actions: {
    open_link: function() {
      modal.close();
      capabilities.window_open(this.get('model.url'), '_blank');
    }
  }
});
