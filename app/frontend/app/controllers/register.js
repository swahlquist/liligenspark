import Controller from '@ember/controller';
import CoughDrop from '../app';
import { computed } from '@ember/object';

export default Controller.extend({
  title: "Register",
  registration_types: CoughDrop.registrationTypes,
  triedToSave: false,
  badEmail: computed('model.email', 'triedToSave', function() {
    var email = this.get('model.email');
    return (this.get('triedToSave') && !email);
  }),
  shortPassword: computed('model.password', 'model.password2', 'triedToSave', function() {
    var password = this.get('model.password') || '';
    var password2 = this.get('model.password2');
    return (this.get('triedToSave') || password == password2) && password.length < 6;
  }),
  noName: computed('model.name', 'model.user_name', 'triedToSave', function() {
    var name = this.get('model.name');
    var user_name = this.get('model.user_name');
    return this.get('triedToSave') && !name && !user_name;
  }),
  noSpacesName: computed('model.user_name', function() {
    return !!(this.get('model.user_name') || '').match(/[\s\.'"]/);
  }),
});
