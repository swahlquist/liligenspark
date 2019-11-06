import modal from '../../utils/modal';
import i18n from '../../utils/i18n';
import utterance from '../../utils/utterance';
import RSVP from 'rsvp';
import stashes from '../../utils/_stashes';
import evaluation from '../../utils/eval';

export default modal.ModalController.extend({
  opening: function() {
    var settings = Object.assign({}, this.get('model.assessment'));
    if(settings.name == 'Unnamed Eval') {
      settings.name = "";
    }
    this.set('settings', settings);
  },
  name_placeholder: function() {
    return i18n.t('eval_for', "Eval for ") + (this.get('settings.for_user.user_name') || this.get('settings.user_name')) + " - " + window.moment().format('MMM Do YYYY');
  }.property('settings.user_name', 'settings.for_user.user_name'),
  save_option: function() {
    return this.get('model.action') == 'results';
  }.property('model.action'),
  actions: {
    confirm: function() {
      // update assessment settings
      modal.close();
      if(!this.get('settings.name')) {
        this.set('settings.name', this.get('name_placeholder'));
      }
      evaluation.update(this.get('settings'), this.get('model.action') != 'results');
      if(this.get('model.action') == 'results') {
        evaluation.persist(this.get('settings'));
      }
    }
  }
});
