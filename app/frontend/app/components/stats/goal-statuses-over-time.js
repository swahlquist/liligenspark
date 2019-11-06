import Component from '@ember/component';
import $ from 'jquery';
import CoughDrop from '../../app';
import i18n from '../../utils/i18n';

export default Component.extend({
  didInsertElement: function() {
    this.draw();
  },
  draw: observer('goal.draw_id', function() {
    var $elem = $(this.get('element'));
    $elem.find(".time_block,.time_block_left").tooltip({container: 'body'});
  })
});

