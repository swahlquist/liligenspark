import CoughDrop from '../app';
import app_state from '../utils/app_state';
import contentGrabbers from '../utils/content_grabbers';
import modal from '../utils/modal';

export default modal.ModalController.extend({
  opening: function() {
    var _this = this;
    _this.set('status', null);
    if(_this.get('model.org.saml_metadata_url')) {
      _this.set('external_auth', true);
    }
  },
  actions: {
    close: function() {
      modal.close(false);
    },
    save: function() {
      var _this = this;
      if(!_this.get('external_auth')) {
        _this.set('model.org.saml_metadata_url', null);
        _this.set('model.org.saml_sso_url', null);
      }
      var org = _this.get('model.org');
      _this.set('status', {saving: true});
      org.save().then(function() {
        modal.close({updated: true});
        _this.set('status', null);
      }, function() {
        _this.set('status', {error: true});
      });
    }
  }
});
