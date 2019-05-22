import Ember from 'ember';
import Controller from '@ember/controller';
import app_state from '../utils/app_state';
import session from '../utils/session';
import i18n from '../utils/i18n';
import CoughDrop from '../app';

export default Controller.extend({
  abort_if_unauthorized: function() {
    if(!session.get('isAuthenticated')) {
      this.transitionToRoute('index');
    } else if(app_state.get('currentUser') && !app_state.get('currentUser.permissions.admin_support_actions')) {
      this.transitionToRoute('index');
    } else if(app_state.get('currentUser') && !this.get('word')) {
      this.load_word();
    }
  }.observes('session.isAuthenticated', 'app_state.currentUser'),
  load_word: function() {
    var _this = this;
    _this.set('word', {loading: true});
    var locale = (window.navigator.language || 'en').split(/-|_/)[0];
    
    CoughDrop.store.query('word', {locale: locale, for_review: true}).then(function(data) {
      var words = data.map(function(r) { return r; });
      _this.set('words', words);
      _this.set('word', words[0]);
    }, function(err) {
      _this.set('word', {error: true});
    });
  },
  update_inflection_options: function() {
    var opts = this.get('inflection_options') || {};
    if(this.get('word.word')) {
      opts.base = opts.base || this.get('word.word');
    }
    if(this.get('word.inflection_overrides')) {
      var overrides = this.get('word.inflection_overrides');
      for(var type in overrides) {
        opts[type] = opts[type] || overrides[type];
      }
    }
    var type = this.get('word.primary_part_of_speech');
    var word = opts.base;
    var write = function(attr, method) {
      if(opts[attr] && opts[attr] == opts[attr + '_fallback']) {
        opts[attr] = null;
      }
      opts[attr + '_fallback'] = method(word);
      opts[attr] = opts[attr] || opts[attr + '_fallback'];
    }
    if(type == 'noun') {
      write('plural', i18n.pluralize);
      write('possessive', i18n.possessive);
    } else if(type == 'verb') {
      write()
    } else if(type == 'adjective') {

    } else if(type == 'pronoun') {

    }
    this.set('inflection_options', opts);

  }.observes('word.word', 'word.primary_part_of_speech'),
  word_types: function() {
    return [
      {name: i18n.t('unspecified', "[ Select Type ]"), id: ''},
      {name: i18n.t('noun', "Noun"), id: 'noun'},
      {name: i18n.t('adjective', "Adjective"), id: 'adjective'},
      {name: i18n.t('verb', "Verb"), id: 'verb'},
      {name: i18n.t('pronoun', "Pronoun"), id: 'pronoun'},
    ];
  }.property(),
  word_type: function() {
    var res = {};
    if(this.get('word.primary_part_of_speech')) {
      res[this.get('word.primary_part_of_speech')] = true;
    }
    return res;
  }.property('word.primary_part_of_speech'),
  actions: {
    save: function() {

    },
    skip: function() {
      
    },
    add_extra: function() {
      var extras = [].concat(this.get('extra_inflections') || []);
      extras.push({});
      this.set('extra_inflections', extras);
    }
  }
});

