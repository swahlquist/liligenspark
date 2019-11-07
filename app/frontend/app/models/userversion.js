import DS from 'ember-data';
import CoughDrop from '../app';

CoughDrop.Userversion = DS.Model.extend({
  modifier: DS.attr('raw'),
  created: DS.attr('date'),
  stats: DS.attr('raw'),
  action: DS.attr('string'),
  summary: DS.attr('string'),
  recent: computed(function() {
    var past = window.moment().add(-7, 'day');
    return this.get('created') && this.get('created') > past;
  }).property('app_state.refresh_stamp', 'created')
});

export default CoughDrop.Userversion;
