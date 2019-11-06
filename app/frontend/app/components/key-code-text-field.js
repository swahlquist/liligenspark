import Ember from 'ember';
import Component from '@ember/component';
import $ from 'jquery';

export default Component.extend({
  tagName: 'input',
  type: 'text',
  attributeBindings: ['placeholder'],
  didInsertElement: function() {
    this.update_placeholder();
  },
  update_placeholder: function() {
    if($(this.element)) {
      if(this.get('value')) {
        $(this.element).attr('placeholder', '##');
        $(this.element).attr('value', this.get('value'));
      } else {
        $(this.element).attr('placeholder', '');
      }
    }
  }.observes('value'),
  keyDown: function(event) {
    if(this.get('value') == '9' && event.keyCode == 9) {
      // double-tab to escape text entry lockage
      return;
    }
    $(this.element).val(event.keyCode);
    event.preventDefault();
    this.set('value', event.keyCode);
  }
});
