import { later as runLater } from '@ember/runloop';
import RSVP from 'rsvp';
import DS from 'ember-data';
import CoughDrop from '../app';
import i18n from '../utils/i18n';
import persistence from '../utils/persistence';
import contentGrabbers from '../utils/content_grabbers';
import { observer } from '@ember/object';
import { computed } from '@ember/object';

CoughDrop.Lesson = DS.Model.extend({
  didLoad: function() {
  },
  title: DS.attr('string'),
  url: DS.attr('string'),
  description: DS.attr('string'),
  time_estimate: DS.attr('number'),
  past_cutoff: DS.attr('number'),
  badge: DS.attr('raw'),
  noframe: DS.attr('boolean'),
});

export default CoughDrop.Lesson;
