import modal from '../utils/modal';
import app_state from '../utils/app_state';

export default modal.ModalController.extend({
  actions: {
    confirm: function() {
      var user = app_state.get('currentUser');
      var _this = this;
      if(user) {
        user.set('terms_agree', true);
        user.save().then(function() {
          _this.send('close');
          app_state.set('auto_setup', true);
          _this.transitionToRoute('setup');
        }, function() {
          _this.set('agree_error', true);
        });
      } else {
        _this.send('close');
      }
    }
  }
});
