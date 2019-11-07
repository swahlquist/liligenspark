import DS from 'ember-data';
import CoughDrop from '../app';
import { computed } from '@ember/object';

CoughDrop.Boardversion = DS.Model.extend({
  modifier: DS.attr('raw'),
  created: DS.attr('date'),
  stats: DS.attr('raw'),
  action: DS.attr('string'),
  summary: DS.attr('string'),
  button_labels: DS.attr('raw'),
  grid: DS.attr('raw'),
  immediately_upstream_boards: DS.attr('raw'),
  recent: computed('app_state.refresh_stamp', 'created', function() {
    var past = window.moment().add(-7, 'day');
    return this.get('created') && this.get('created') > past;
  }),
  button_labels_list: computed('button_labels', function() {
    if(this.get('button_labels') && this.get('button_labels').length > 0) {
      return this.get('button_labels').join(', ');
    } else {
      return "";
    }
  })
});

export default CoughDrop.Boardversion;
