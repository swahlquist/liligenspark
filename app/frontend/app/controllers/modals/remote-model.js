import modal from '../../utils/modal';
import sync from '../../utils/sync';
import app_state from '../../utils/app_state';
import CoughDrop from '../../app';
import { computed } from '@ember/object';

export default modal.ModalController.extend({
  opening: function() {
    var _this = this;
    this.set('modeling_type', 'follow');
    if(app_state.get('pairing.model')) {
      app_state.set('modeling_type', 'model');
    }
    CoughDrop.store.findRecord('user', this.get('model.user_id')).then(function(user) {
      _this.set('model.user', user);
    }, function(err) {
      _this.set('model.user_error', true);
    });
  },
  following_mode: computed('modeling_type', function() {
    return this.get('modeling_type') == 'follow';
  }),
  connect_pending: computed('model.status', function() {
    return this.get('model.status.connecting');
  }),
  actions: {
    set_modeling: function(type) {
      this.set('modeling_type', type);
    },
    end: function() {
      if(app_state.get('pairing.user_id')) {
        sync.send(app_state.get('pairing.user_id'), {
          type: 'unpair'
        });
        app_state.set('pairing', null);
        sync.current_pairing = null;
      }
      modal.close();
    },
    request: function() {
      var _this = this;
      _this.set('model.status', {connecting: true});
      var handled = false;
      setTimeout(function() {
        if(handled) { return; }
        handled = true;
        _this.set('model.status', {error_connecting: true});
      }, 5000);
      sync.connect(_this.get('model.user')).then(function() {
        if(handled) { return; }
        handled = true;
        if(_this.get('following_mode')) {
          var sync_handled = false;
          var listen_id = 'remote_model_request.' + (new Date()).getTime();
          setTimeout(function() {
            if(sync_handled) { return; }
            sync_handled = true;
            _this.set('model.status', {pair_timeout: true});
            sync.stop_listening(listen_id);
          }, 60000)
          sync.listen(listen_id, function(message) {
            // Wait until you get an actual update to
            // confirm that the follow is accepted
            if(message && message.user_id == _this.get('model.user.id')) {
              if(message.type == 'update' && message.data.board_state) {
                sync_handled = true;
                sync.stop_listening(listen_id);
                modal.close();
                app_state.set('pairing', {partner: true, follow: true, user: _this.get('model.user'), user_id: _this.get('model.user.id'), communicator_id: _this.get('model.user.id')});
                app_state.set_speak_mode_user(_this.get('model.user.id'), true, true);      
              }
            }
          });
          // TODO: wait for any update before marking as official
          setTimeout(function() {
            sync.send(_this.get('model.user.id'), {type: 'query', following: true});
          }, 500);
        } else {
          var sync_handled = false;
          setTimeout(function() {
            if(!sync_handled) {
              sync_handled = true;
              _this.set('model.status', {pair_timeout: true});
            }
          }, 60000);
          sync.request_pair(_this.get('model.user.id')).then(function(res) {
            modal.close();
            app_state.set('pairing', {partner: true, model: true, user: _this.get('model.user'), user_id: _this.get('model.user.id'), communicator_id: _this.get('model.user.id')});
            app_state.set_speak_mode_user(_this.get('model.user.id'), true, true);
            setTimeout(function() {
              sync.send(_this.get('model.user.id'), {type: 'query'});
            }, 500);
          }, function(err) {
            _this.set('model.status', {pair_reject: true});
          });
          // request pairing
        }
      }, function(err) {
        _this.set('model.status', {error_connecting: true});
      });
    }
  }
});
