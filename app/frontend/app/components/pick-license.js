import Component from '@ember/component';
import app_state from '../utils/app_state';

export default Component.extend({
  tagName: 'span',
  licenseOptions: computed(function() {
    return app_state.get('licenseOptions');
  }).property(),
  private_license: computed(function() {
    return this.get('license.type') == 'private';
  }).property('license.type')
});
