import CoughDrop from '../app';
import RSVP from 'rsvp';
import modal from '../utils/modal';
import i18n from '../utils/i18n';
import app_state from '../utils/app_state';
import { computed } from '@ember/object';

var devices = [
  {id: 'grid', name: i18n.t('grid', "Grid"), vocabs: [

  ]},
  {id: 'lamp_wfl', name: i18n.t('lamp_words_for_life', "LAMP Words for Life"), vocabs: [

  ]},
  {id: 'podd_book', name: i18n.t('podd_book', "PODD Book"), vocabs: [
    {id: 'printed_podd', name: i18n.t('printed_podd', "Printed PODD Book")},
    {id: 'simpodd_15', name: i18n.t('simpodd_15', "simPODD 15"), default_size: 15},
    {id: 'simpodd_60', name: i18n.t('simpodd_60', "simPODD 60"), default_size: 60},
  ]},
  {id: 'prc_accent', name: i18n.t('prc_accent', "PRC Accent Series"), vocabs: [

  ]},
  {id: 'p2g', name: i18n.t('proloquo2go', "Proloquo2Go"), vocabs: [
    // crescendo, gateway
  ]},
  {id: 'p4text', name: i18n.t('proloquo4text', "Proloquo4Text"), vocabs: [
  ]},
  {id: 'sfy', name: i18n.t('speak_for_yourself', "Speak for Yourself"), vocabs: [
    // sfy
  ]},
  {id: 'td_snap', name: i18n.t('td_snap', "TD Snap"), vocabs: [
    // core first, text, scanning, podd, gateway, aphasia
    // https://us.tobiidynavox.com/pages/td-snap
  ]},
  {id: 'tobii_i', name: i18n.t('tobii_i_series', "Tobii i-Series"), vocabs: [

  ]},
  {id: 'go_talk', name: i18n.t('go_talk', "GoTalk Device"), vocabs: []},
  {id: 'e_tran', name: i18n.t('e_tran', "E-Tran or Clear Plastic Board"), vocabs: []}
];

export default modal.ModalController.extend({
  opening: function() {
    var user = CoughDrop.store.createRecord('user', {
      preferences: {
        registration_type: 'manually-added-org-user'
      },
      authored_organization_id: this.get('model.organization_id'),
      org_management_action: 'add_manager'
    });
    this.set('linking', false);
    this.set('error', null);
    user.set('watch_user_name_and_cookies', true);
    this.set('model.user', user);
    this.set('model.user.org_management_action', this.get('model.default_org_management_action'));
  },
  user_types: computed('model.no_licenses', 'model.no_supervisor_licenses', 'model.no_eval_licenses', function() {
    var res = [];
    res.push({id: '', name: i18n.t('select_user_type', "[ Add This User As ]")});
    if(this.get('model.no_licenses')) {
      res.push({id: 'add_user', disabled: true, name: i18n.t('add_sponsored_used', "Add this User As a Sponsored Communicator")});
      if(this.get('model.user.org_management_action') == 'add_user') {
        this.set_unsponsored_action();
      }
    } else {
      res.push({id: 'add_user', name: i18n.t('add_sponsored_used', "Add this User As a Sponsored Communicator")});
    }
    res.push({id: 'add_unsponsored_user', name: i18n.t('add_unsponsored_used', "Add this User As an Unsponsored Communicator")});
    if(this.get('model.premium')) {
      res.push({id: 'add_external_user', name: i18n.t('add_unsponsored_used', "Add this User As an Third-Party App Communicator")});
    }
    if(this.get('model.no_supervisor_licenses')) {
      res.push({id: 'add_premium_supervisor', disabled: true, name: i18n.t('add_as_premium_supervisor', "Add this User As a Premium Supervisor")});
      if(this.get('model.user.org_management_action') == 'add_premium_supervisor') {
        this.set_unsponsored_action('supervisor');
      }
    } else {
      res.push({id: 'add_premium_supervisor', name: i18n.t('add_as_premium_supervisor', "Add this User As a Premium Supervisor")});
    }
    res.push({id: 'add_supervisor', name: i18n.t('add_as_supervisor', "Add this User As a Supervisor")});
    res.push({id: 'add_manager', name: i18n.t('add_as_manager', "Add this User As a Full Manager")});
    res.push({id: 'add_assistant', name: i18n.t('add_as_assistant', "Add this User As a Management Assistant")});
    if(this.get('model.no_eval_licenses')) {
      res.push({id: 'add_eval', disabled: true, name: i18n.t('add_paid_eval', "Add this User As a Paid Eval Account")});
      if(this.get('model.user.org_management_action') == 'add_eval') {
        this.set_unsponsored_action();
      }
    } else {
      res.push({id: 'add_eval', name: i18n.t('add_paid_eval', "Add this User As a Paid Eval Account")});
    }
    return res;
  }),
  locale_list: computed(function() {
    var list = i18n.get('locales');
    var res = [{name: i18n.t('english_default', "English (default)"), id: 'en'}];
    for(var key in list) {
      if(!key.match(/-|_/)) {
        var str = /* i18n.locales_localized[key] ||*/ i18n.locales[key] || key;
        res.push({name: str, id: key});
      }
    }
    return res;
  }),
  third_party_new_user: computed('model.user.org_management_action', function() {
    return this.get('model.user.org_management_action') == 'add_external_user';
  }),
  communicator_new_user: computed('model.user.org_management_action', function() {
    return this.get('model.user.org_management_action') == 'add_user' || this.get('model.user.org_management_action') == 'add_unsponsored_user';
  }),
  device_options: computed(function() {
    return [].concat(devices).concat({id: 'other', name: i18n.t('other', "Other")});
  }),
  vocab_options: computed('model.user.external_device', function() {
    var str = this.get('model.user.external_device');
    var device = devices.find(function(d) { return d.name == str; });
    var res = [];
    if(device && device.vocabs && device.vocabs.length > 0) {
      res = res.concat(device.vocabs);
    }
    return res.concat([{id: 'custom', name: i18n.t('custom_vocab', "Custom Vocabulary")}]);
  }),
  set_unsponsored_action(type) {
    if(type == 'supervisor') {
      this.set('model.user.org_management_action', 'add_supervisor');      
    } else {
      this.set('model.user.org_management_action', 'add_unsponsored_user');
    }
  },
  linking_or_exists: computed('linking', 'model.user.user_name_check.exists', function() {
    return this.get('linking') || this.get('model.user.user_name_check.exists');
  }),
  actions: {
    set_device: function(device) {
      device.name = '';
      this.set('external_device', device);
    },
    set_vocab: function(vocab) {
      this.set('external_vocab', vocab);
      if(vocab.default_size) {
        this.set('external_vocab_size', vocab.default_size);
      }
    },
    add: function() {
      var controller = this;
      controller.set('linking', true);

      var user = this.get('model.user');
      user.set('watch_user_name_and_cookies', false);

      if(this.get('third_party_new_user') && this.get('external_device.name')) {
        var dev = this.get('external_device');
        dev.vocab_id = this.get('external_vocab.id');
        dev.vocab = this.get('external_vocab.name');
        dev.vocab_size = parseInt(this.get('external_vocab_size'), 10) || null;
        user.set('external_device', dev);
      }
      var get_user_name = user.save().then(function(user) {
        return user.get('user_name');
      }, function() {
        return RSVP.reject(i18n.t('creating_user_failed', "Failed to create a new user with the given settings"));
      });

      var action = user.get('org_management_action');
      get_user_name.then(function(user_name) {
        var user = controller.get('model.user');
        user.set('org_management_action', action);
        modal.close({
          created: true,
          user: user
        });
      }, function(err) {
          controller.set('linking', false);
          controller.set('error', err);
      });
    }
  }
});
