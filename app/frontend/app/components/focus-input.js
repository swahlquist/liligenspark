import { on } from '@ember/object/evented';
import capabilities from '../utils/capabilities';
import TextField from '@ember/component/text-field';
import $ from 'jquery';

export default TextField.extend({
  becomeFocused: on('didInsertElement', function() {
    if(!capabilities.mobile || this.get('force')) {
      $(this.element).focus().select();
    }
  }),
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
