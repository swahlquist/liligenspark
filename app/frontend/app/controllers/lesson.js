import Controller from '@ember/controller';
import persistence from '../utils/persistence';
import { computed } from '@ember/object';

export default Controller.extend({
  finished_at: computed('model.user.completion', function() {
    var comp = this.get('model.user.completion');
    if(comp) {
      var ts = new Date(comp.ts * 1000);
      return ts;
    }
    return null;
  }),
  actions: {
    toggle_description: function() {
      this.set('show_description', !this.get('show_description'));
    },
    done: function() {
      this.set('show_rating', !this.get('show_rating'));
    },
    new_window: function() {
      window.open(this.get('model.url'), '_blank');
    },
    rate: function(score) {
      var _this = this;
      _this.set('status', {saving: true})
      persistence.ajax('/api/v1/lessons/' + this.get('model.id') + '/complete', {type: 'POST', data: {rating: score}}).then(function(res) {
        _this.set('status', {done: true})
      }, function(err) {
        _this.set('status', {error: true});
      });
    }
  }
});
