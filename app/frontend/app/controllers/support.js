import app_state from '../utils/app_state';
import modal from '../utils/modal';
import persistence from '../utils/persistence';
import i18n from '../utils/i18n';

export default modal.ModalController.extend({
  ios: function() {
    return window.navigator.userAgent.match(/ipad|ipod|iphone/i);
  }.property(),
  actions: {
    submit_message: function() {
      if(!this.get('email') && !app_state.get('currentUser')) { return; }
      var message = {
        name: this.get('name'),
        email: this.get('email'),
        recipient: 'support',
        subject: this.get('subject'),
        message: this.get('message')
      };
      var _this = this;
      this.set('disabled', true);
      this.set('error', false);
      persistence.ajax('/api/v1/messages', {
        type: 'POST',
        data: {
          message: message
        }
      }).then(function(res) {
        _this.set('disabled', false);
        modal.success(i18n.t('message_delivered', "Message sent! Thank you for reaching out!"));
        modal.close();
      }, function() {
        _this.set('error', true);
        _this.set('disabled', false);
      });

    }
  }
});
