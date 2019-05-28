import Ember from 'ember';
import Controller from '@ember/controller';
import app_state from '../utils/app_state';
import session from '../utils/session';
import i18n from '../utils/i18n';
import CoughDrop from '../app';
import {set as emberSet, get as emberGet} from '@ember/object';

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
    _this.set('status', null);
    _this.set('word', {loading: true});
    _this.set('inflection_options', null);
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
    if(this.get('word.word') || emberGet(opts, 'base') != "") {
      emberSet(opts, 'base', emberGet(opts, 'base') || this.get('word.word'));
    }
    if(this.get('word.inflection_overrides')) {
      var overrides = this.get('word.inflection_overrides');
      for(var type in overrides) {
        emberSet(opts, type, emberGet(opts, type) || overrides[type]);
      }
    }
    var type = this.get('word.primary_part_of_speech');
    var word = opts.base;
    var write = function(attr, method) {
      if(opts[attr] && opts[attr] == opts[attr + '_fallback']) {
        opts[attr] = null;
      }
      emberSet(opts, attr + '_fallback', method.call(i18n, word));
      emberSet(opts, attr, opts[attr] || opts[attr + '_fallback']);
    }
    if(type == 'noun') {
      write('plural', i18n.pluralize);
      write('possessive', i18n.possessive);
    } else if(type == 'verb') {
      write('infinitive', function(word) { return i18n.tense(word, {infinitive: true}); });
      write('simple_present', function(word) { return i18n.tense(word, {simple_present: true}); });
      write('simple_past', function(word) { return i18n.tense(word, {simple_past: true}); });
      write('present_participle', function(word) { return i18n.tense(word, {present_participle: true}); });
      write('past_participle', function(word) { return i18n.tense(word, {past_participle: true}); });
    } else if(type == 'adjective') {
      write('plural', i18n.pluralize);
      write('comparative', i18n.comparative);
      write('superlative', i18n.superlative);
      write('negation', i18n.negation);
    } else if(type == 'pronoun') {
      write('objective',  function(word) { return i18n.possessive(word, {objective: true}); });
      write('possessive', function(word) { return i18n.possessive(word, {pronoun: true}); });
      write('possessive_adjective', function(word) { return i18n.possessive(word, {}); });
      write('reflexive',  function(word) { return i18n.possessive(word, {reflexive: true}); });
    } else {
      write('negation', i18n.negation);
    }
    this.set('inflection_options', opts);

  }.observes('word.word', 'word.primary_part_of_speech', 'inflection_options.base'),
  word_types: function() {
    return [
      {name: i18n.t('unspecified', "[ Select Type ]"), id: ''},
      {name: i18n.t('noun', "Noun (dog, window, idea)"), id: 'noun'},
      {name: i18n.t('verb', "Verb (run, jump, cry, think)"), id: 'verb'},
      {name: i18n.t('adjective', "Adjective (red, ugly, humble)"), id: 'adjective'},
      {name: i18n.t('pronoun', "Pronoun (we, I, you, someone, anybody)"), id: 'pronoun'},
      {name: i18n.t('adverb', "Adverb (kindly, often)"), id: 'pronoun'},
      {name: i18n.t('question', "Question (why, when)"), id: 'question'},
      {name: i18n.t('conjunction', "Conjunction (and, but, if, because, although)"), id: 'conjunction'},
      {name: i18n.t('negation', "Negation (not, never)"), id: 'negation'},
      // https://www.talkenglish.com/vocabulary/top-50-prepositions.aspx
      {name: i18n.t('preposition', "Preposition (after, in, on, to, with)"), id: 'preposition'},
      {name: i18n.t('interjection', "Interjection (ahem, duh, hey)"), id: 'interjection'},
      {name: i18n.t('article', "Article (a, an, the)"), id: 'article'},
      // https://www.ef.edu/english-resources/english-grammar/determiners/
      {name: i18n.t('determiner', "Determiner (this, that, some, any, other, such, quite)"), id: 'determiner'},
      {name: i18n.t('number', "Number (one, two, three)"), id: 'numeral'},
      {name: i18n.t('other', "Other word type"), id: ''},
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
      var _this = this;
      var word = _this.get('word');
      var overrides = word.get('inflection_overrides');
      var options = _this.get('inflection_options');
      for(var key in options) {
        if(key == 'base' && options[key] != word.get('word')) {
          overrides[key] = options[key]
        } else if(!key.match(/_fallback$/)) {
          if(options[key] && options[key] != options[key + '_fallback']) {
            overrides[key] = options[key];
          }
        }
      }
      word.set('inflection_overrides', overrides);
      _this.set('status', {saving: true});
      word.save().then(function() {
        _this.set('status', null);
        _this.load_word();
      }, function(err) {
        _this.set('status', {error: true});
      });
    },
    skip: function() {
      this.set('word.skip', true);
      this.send('save');
    },
    add_extra: function() {
      var extras = [].concat(this.get('extra_inflections') || []);
      extras.push({});
      this.set('extra_inflections', extras);
    }
  }
});

