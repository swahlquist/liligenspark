import Component from '@ember/component';

export default Component.extend({
  tagName: 'span',
  protected_license: computed(function() {
    return this.get('license.protected');
  }).property('license.protected'),
  private_license: computed(function() {
    return this.get('license.type') == 'private';
  }).property('license.type')
});
