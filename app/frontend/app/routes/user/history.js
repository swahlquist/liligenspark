import Ember from 'ember';
import i18n from '../../utils/i18n';

export default Ember.Route.extend({
  model: function(params) {
    return this.modelFor('user');
  },
  setupController: function(controller, model) {
    model.set('show_history', true);
    controller.set('model', model);
    controller.load_results();
  }
});
