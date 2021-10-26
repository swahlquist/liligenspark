import { later as runLater } from '@ember/runloop';
import RSVP from 'rsvp';
import DS from 'ember-data';
import CoughDrop from '../app';
import i18n from '../utils/i18n';
import persistence from '../utils/persistence';
import contentGrabbers from '../utils/content_grabbers';
import { observer } from '@ember/object';
import { computed } from '@ember/object';

CoughDrop.Profile = DS.Model.extend({
  didLoad: function() {
  },
  profile_id: DS.attr('string'),
  public: DS.attr('string'),
  template: DS.attr('raw'),
  permissions: DS.attr('raw')
});

export default CoughDrop.Profile;
