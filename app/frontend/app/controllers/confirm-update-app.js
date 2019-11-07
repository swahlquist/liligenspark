import modal from '../utils/modal';
import { computed } from '@ember/object';

export default modal.ModalController.extend({
  version: computed(function() {
    return (window.CoughDrop && window.CoughDrop.update_version) || 'unknown';
  }),
  actions: {
    restart: function() {
      if(window.CoughDrop && window.CoughDrop.install_update) {
        window.CoughDrop.install_update();
      } else {
        this.set('error', true);
      }
    }
  }
});
