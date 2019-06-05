import Ember from 'ember';
import Controller from '@ember/controller';
import app_state from '../utils/app_state';
import session from '../utils/session';
import i18n from '../utils/i18n';
import CoughDrop from '../app';
import {set as emberSet, get as emberGet} from '@ember/object';
import { htmlSafe } from '@ember/string';

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
    var types = _this.get('word_types');
    types.forEach(function(type) {
      emberSet(type, 'checked', false);
    });
    var locale = (this.get('locale') || window.navigator.language || 'en').split(/-|_/)[0];
    var opts = {locale: locale, for_review: true};
    if(_this.get('ref')) {
      opts.word = _this.get('ref');
    }
    CoughDrop.store.query('word', opts).then(function(data) {
      var words = data.map(function(r) { return r; });
      _this.set('antonyms', null);
      if(words[0].get('word') != _this.get('ref') || words[0].get('locale') != _this.get('locale')) {
        _this.transitionToRoute('inflections', words[0].get('word'), words[0].get('locale'));
      }
      _this.set('words', words);
      _this.set('word', words[0]);
    }, function(err) {
      _this.set('word', {error: true});
    });
  },
  update_inflection_options: function() {
    if(!this.get('word.word')) { return; }
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
    var word = opts.base || "";
    var write = function(attr, method) {
      if(opts[attr] && opts[attr] == opts[attr + '_fallback']) {
        opts[attr] = null;
      }
      emberSet(opts, attr + '_fallback', method.call(i18n, word));
      emberSet(opts, attr, opts[attr] || opts[attr + '_fallback']);
    }
    var parts = this.get('parts_of_speech');
    if(parts.noun) {
      write('plural', i18n.pluralize);
      write('possessive', i18n.possessive);
    }
    if(parts.verb) {
      write('infinitive', function(word) { return i18n.tense(word, {infinitive: true}); });
      write('present', function(word) { return word; });
      write('simple_present', function(word) { return i18n.tense(word, {simple_present: true}); });
      write('plural_present', function(word) { return word; });
      write('past', function(word) { return i18n.tense(word, {simple_past: true}); });
      write('simple_past', function(word) { return i18n.tense(word, {simple_past: true}); });
      write('present_participle', function(word) { return i18n.tense(word, {present_participle: true}); });
      write('past_participle', function(word) { return i18n.tense(word, {past_participle: true}); });
    }
    if(parts.adjective || parts.adverb) {
      if(parts.adjective) {
        write('plural', i18n.pluralize);
      }
      write('comparative', i18n.comparative);
      write('negative_comparative', function(word) { return i18n.comparative(word, {negative: true}); });
      write('superlative', i18n.superlative);
      write('negation', i18n.negation);
    }
    if(parts.pronoun) {
      write('objective',  function(word) { return i18n.possessive(word, {objective: true}); });
      write('possessive', function(word) { return i18n.possessive(word, {pronoun: true}); });
      write('possessive_adjective', function(word) { return i18n.possessive(word, {}); });
      write('reflexive',  function(word) { return i18n.possessive(word, {reflexive: true}); });
    }
    if(parts.noun || parts.verb || parts.adjective || parts.adverb || parts.pronoun || parts.article || parts.preposition || parts.article || parts.determiner) {
      write('negation', i18n.negation);
    }

    this.set('inflection_options', opts);
    this.set('antonyms', this.get('antonyms') || (this.get('word.antonyms') || []).join(', '));
  }.observes('word.word', 'word.primary_part_of_speech', 'inflection_options.base', 'word.antonyms', 'word.parts_of_speech', 'parts_of_speech'),
  lookup_link: function() {
    return "https://www.google.com/search?q=define:" + encodeURIComponent(this.get('word.word'));
  }.property('word'),
  word_type_style: function() {
    var _this = this;
    var type = this.get('word_types').find(function(t) { return t.id == _this.get('word.primary_part_of_speech'); });
    return type && htmlSafe(type.extra_style + ' padding: 10px; border-radius: 5px;');
  }.property('word.primary_part_of_speech', 'word_types'),
  word_types: function() {
    var res = [
      {name: i18n.t('unspecified', "[ Select Type ]"), id: ''},
      {name: i18n.t('noun', "Noun (dog, window, idea)"), id: 'noun'},
      {name: i18n.t('verb', "Verb (run, jump, cry, think)"), id: 'verb'},
      {name: i18n.t('adjective', "Adjective (red, ugly, humble)"), id: 'adjective'},
      {name: i18n.t('pronoun', "Pronoun (we, I, you, someone, anybody)"), id: 'pronoun'},
      {name: i18n.t('adverb', "Adverb (kindly, often)"), id: 'adverb'},
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
      {name: i18n.t('social_phrase', "Social Phrase (hello, thank you)"), id: 'social'},
      {name: i18n.t('other', "Other word type"), id: ''},
    ];
    
    var _this = this;
    var parts = _this.get('word.parts_of_speech') || [];
    res.forEach(function(type) {
      type.checked = !!(parts.indexOf(type.id) != -1) || type.id == _this.get('word.primary_part_of_speech');
      type.style = 'float: left; width: 50%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-radius: 0;';
      CoughDrop.keyed_colors.forEach(function(color) {
        if(color.types.indexOf(type.id) != -1) {
          type.border = color.border;
          type.fill = color.fill;
          type.extra_style = htmlSafe(' border: 1px solid ' + type.border + '; background: ' + type.fill + ';');
          type.style = htmlSafe(type.style + type.extra_style);
        }
      });
    });
    return res;
  }.property('word.parts_of_speech'),
  update_primary_on_single_word_type: function(ref, change) {
    var single_type = null;
    var multiple = false;
    this.get('word_types').forEach(function(t) { 
      if(t.checked && single_type) {
        multiple = true;
      } else if(t.checked) {
        single_type = t.id;
      }
    });
    var types = this.get('word_types');
    var pos = this.get('word.primary_part_of_speech');
    var type = types.find(function(t) { return t.id == pos; });
    if(single_type && !multiple) {
      this.set('word.primary_part_of_speech', single_type);
    } else if(change == 'word.primary_part_of_speech' && type) {
      emberSet(type, 'checked', true);
    } else if(multiple && type && !type.checked) {
      type = types.find(function(t) { return t.checked; });
      if(type) { this.set('word.primary_part_of_speech', type.id); }
    }
  }.observes('word_types', 'word_types.@each.checked', 'word.primary_part_of_speech'),
  word_type: function() {
    var res = {};
    if(this.get('word.primary_part_of_speech')) {
      res[this.get('word.primary_part_of_speech')] = true;
    }
    if(['adjective', 'adverb'].indexOf(this.get('word.primary_part_of_speech')) != -1) {
      res['adjective_or_adverb'] = true;
    }
    return res;
  }.property('word.primary_part_of_speech'),
  parts_of_speech: function() {
    var res = {};
    this.get('word_types').forEach(function(type) {
      if(type.checked) { res[type.id] = true; }
    });
    if(res.noun || res.verb || res.adjective || res.pronoun || res.adverb || res.preposition || res.determiner || res.negation) {
      res.oppositable = true;
    }
    return res;
  }.property('word.parts_of_speech', 'word_types', 'word_types.@each.checked'),
  actions: {
    save: function() {
      var _this = this;
      var word = _this.get('word');
      if(this.get('antonyms')) {
        word.set('antonyms', _this.get('antonyms').split(','));
      }
      var types = _this.get('word_types');
      var list = [];
      types.forEach(function(type) {
        if(type.checked) { list.push(type.id); }
      });
      word.set('parts_of_speech', list);
      var overrides = word.get('inflection_overrides');
      var options = _this.get('inflection_options');
      var regulars = [];
      for(var key in options) {
        if(key == 'regulars') {
          regulars = regulars.concat(options[key]).uniq();
        } else if(key == 'base') {
          overrides[key] = options[key]
          if(options[key] == word.get('word')) {
            regulars.push('base');
          }
        } else if(!key.match(/_fallback$/)) {
          overrides[key] = options[key];
          if(options[key] && options[key] == options[key + '_fallback']) {
            regulars.push(key);
          }
        }
      }
      overrides['regulars'] = regulars;
      word.set('inflection_overrides', overrides);
      _this.set('status', {saving: true});
      word.save().then(function() {
        _this.set('status', null);
        var found = false;
        _this.get('words').forEach(function(w) {
          if(w.get('word') != _this.get('word.word') && !found) {
            found = true;
            _this.set('inflection_options', null);
            var types = _this.get('word_types');
            types.forEach(function(type) {
              emberSet(type, 'checked', false);
            });
            _this.transitionToRoute('inflections', w.get('word'), w.get('locale'));
          }
        });
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

