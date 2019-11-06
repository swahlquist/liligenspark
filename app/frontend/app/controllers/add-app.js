import modal from '../utils/modal';

export default modal.ModalController.extend({
  device: function() {
    return {
      standalone: navigator.standalone,
      android: (navigator.userAgent.match(/android/i) && navigator.userAgent.match(/chrome/i)),
      ios: (navigator.userAgent.match(/mobile/i) && navigator.userAgent.match(/safari/i))
    };
  }.property(),
  actions: {
    close: function() {
      modal.close();
    }
  }
});