import Ember from 'ember';
import frame_listener from '../utils/frame_listener';
import CoughDrop from '../app';

export default Ember.Component.extend({
  willDestroyElement: function() {
    frame_listener.unload();
  },
  actions: {
  }
});
