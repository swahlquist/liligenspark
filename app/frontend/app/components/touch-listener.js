import Component from '@ember/component';
import buttonTracker from '../utils/raw_events';
import app_state from '../utils/app_state';
import editManager from '../utils/edit_manager';
import capabilities from '../utils/capabilities';

export default Component.extend({
  tagName: 'span',
  mouseDown: function() {
    // on iOS (probably just UIWebView) this phantom
    // click event get triggered. If you tap & release 
    // really fast then tap somewhere else, right after
    // touchstart a click gets triggered at the location
    // you hit and released before.
    var ignore = false;
    if(buttonTracker.lastTouchStart) {
      var now = (new Date()).getTime();
      if(capabilities.mobile && now - buttonTracker.lastTouchStart < 300) {
        ignore = true;
      }
    }
    if(!ignore) {
      this.sendAction('select');
    }
    return true;
  },
  touchStart: function() {
    this.sendAction('select');
    return true;
  }
});
