import modal from '../utils/modal';
import app_state from '../utils/app_state';

export default modal.ModalController.extend({
  opening: function() {
    this.set('model', this.get('model.user'));
    this.set('model.load_all_connections', true);
  },
  show_supervisees: function() {
    var res = this.get('model.supervisees.length') || this.get('model.known_supervisees.length');
    return res > 0;
  }.property('model.supervisees', 'model.known_supervisees', 'model.all_connections.loading', 'model.all_connections.error'),
  actions: {
    close: function() {
      modal.close();
    },
    remove_supervisor: function(id) {
      var user = this.get('model');
      user.set('supervisor_key', "remove_supervisor-" + id);
      user.save().then(null, function() {
        alert("sadness!");
      });
    },
    remove_supervision: function(id) {
      var user = this.get('model');
      user.set('supervisor_key', "remove_supervision-" + id);
      user.save().then(null, function() {
        alert("sadness!");
      });
    },
    remove_supervisee: function(id) {
      var user = this.get('model');
      user.set('supervisor_key', "remove_supervisee-" + id);
      user.save().then(null, function() {
        alert("sadness!");
      });
    },
    add_supervisor: function() {
      var _this = this;
      app_state.check_for_currently_premium(_this.get('model'), 'add_supervisor', true).then(function() {
        modal.open('add-supervisor', {user: _this.get('model')});
      }, function() { });
    },
    add_supervisee: function() {
      this.set('add_supervisee_hit', !this.get('add_supervisee_hit'));
    }
  }
});
