import Ember from 'ember';
import frame_listener from '../utils/frame_listener';

export default Ember.Component.extend({
  tagName: 'div',
  classNames: ['integration_container'],
  didInsertElement: function() {
    var elem = this.element;
    this.element.addEventListener('mousemove', function(event) {
      if(elem) {
        var session_id = elem.childNodes[0].getAttribute('data-session_id');
//         frame_listener.raw_event({
//           session_id: session_id,
//           type: 'mousemove',
//           x_percent: 0.1,
//           y_percent: 0.2
//         });
      }
    });
    this.element.addEventListener('click', function(e) {
      if(elem) {
        var session_id = elem.childNodes[0].getAttribute('data-session_id');
//         frame_listener.raw_event({
//           session_id: session_id,
//           type: 'click',
//           x_percent: 0.3,
//           y_percent: 0.325
//         });
      }
    });
  },
  overlay_style: function() {
    var res = this.get('board_style');
    res = res.string || res;
    if(res && res.replace) {
      res = res.replace(/position:\s*relative/, 'position: absolute');
    }
    return Ember.String.htmlSafe(res);
  }.property('board_style'),
  actions: {
  }
});
