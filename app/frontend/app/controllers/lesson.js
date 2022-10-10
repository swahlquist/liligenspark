import Controller from '@ember/controller';
import persistence from '../utils/persistence';
import { computed, observer } from '@ember/object';
import CoughDrop from '../app';

export default Controller.extend({
  setup_tracking: function() {
    this.set('status', null);
    this.set('show_description', false);
    this.set('show_rating', false);
    this.set('player', null);
    this.set('forced_show', false);
    if(this.get('model.video')) {
      var _this = this;
      CoughDrop.Videos.track('lesson_embed').then(function(player) {
        _this.set('player', player);
      });
    }
  },
  set_video_complete: observer('player.time', 'player.duration', function() {
    var time = this.get('player.time');
    var duration = this.get('player.duration');
    if(time && duration && !this.get('forced_show')) {
      if(time / duration > 0.93) {
        this.set('forced_show', true);
        this.set('show_rating', true);
      } else if(duration > (5 * 60) && (duration - time) < (30)) {
        this.set('forced_show', true);
        this.set('show_rating', true);
      } else if(duration > (10 * 60) && (duration - time) < (60)) {
        this.set('forced_show', true);
        this.set('show_rating', true);
      }
    }
  }),
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
