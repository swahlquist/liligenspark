import Ember from 'ember';
import capabilities from '../utils/capabilities';
import TextField from '@ember/component/text-field';

export default TextField.extend({
  becomeFocused: function() {
    if(!capabilities.mobile || this.get('force')) {
      this.$().focus().select();
    }
  }.on('didInsertElement'),
  focusOut: function() {
    this.sendAction();
  },
  keyDown: function(event) {
    if(event.keyCode == 13) {
      event.preventDefault();
      event.stopPropagation();
      if(this.get('select')) {
        this.sendAction('select');
      }
    }
  }
});
