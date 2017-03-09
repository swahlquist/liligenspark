import Ember from 'ember';
import modal from '../utils/modal';
import i18n from '../utils/i18n';
import app_state from '../utils/app_state';
import persistence from '../utils/persistence';
import CoughDrop from '../app';

export default modal.ModalController.extend({
  opening: function() {
    var _this = this;
    _this.set('sentence_state', {});
    _this.load_part_of_speech();
    if(!this.get('model.core_lists') && this.get('model.user.id')) {
      persistence.ajax('/api/v1/users/' + this.get('model.user.id') + '/core_lists', {type: 'GET'}).then(function(res) {
        _this.set('model.core_lists', res);
      }, function(err) { });
    }
  },
  load_part_of_speech: function() {
    var _this = this;
    _this.set('parts_of_speech', {loading: true});
    persistence.ajax('/api/v1/search/parts_of_speech?suggestions=true&q=' + encodeURIComponent(_this.get('model.word')), {
      type: 'GET'
    }).then(function(res) {
      _this.set('parts_of_speech', res);
      _this.set('suggestions', res.sentences);
    }, function(err) {
      _this.set('parts_of_speech', {error: true});
    });
  },
  reachability: function() {
    var lists = this.get('model.user.core_lists');
    var res = {};
    var word = this.get('model.word').toLowerCase();
    if(lists && lists.reachable_for_user) {
      var found = lists.for_user.find(function(w) { return w.toLowerCase() == word; });
      var reachable_found = lists.reachable_for_user.find(function(w) { return w.toLowerCase() == word; });
      if(found) {
        res.core = true;
        if(reachable_found) {
          res.reachable = true;
        } else {
          res.unreachable = true;
        }
      } else {
        res.not_core = true;
      }
    }
    return res;
  }.property('model.word', 'model.user.core_lists'),
  part_of_speech: function() {
    if(this.get('parts_of_speech.types')) {
      return this.get('parts_of_speech.types')[0];
    }
    return null;
  }.property('parts_of_speech'),
  part_of_speech_class: function() {
    var pos = this.get('part_of_speech');
    if(pos) {
      return Ember.String.htmlSafe('part_of_speech_box ' + pos);
    } else {
      return null;
    }
  }.property('part_of_speech'),
  frequency: function() {
    var _this = this;
    var word = (this.get('model.usage_stats.words_by_frequency') || []).find(function(w) { return w.text.toLowerCase() == _this.get('model.word').toLowerCase(); });
    var count = (word && word.count) || 0;
    var pct = 0;
    if(this.get('model.usage_stats.total_words')) {
      pct = Math.round(count / this.get('model.usage_stats.total_words') * 1000) / 10;
    }
    return {
      total: count,
      percent: pct
    };
  }.property('model.usage_stats'),
  actions: {
    add_sentence: function() {
      var _this = this;
      var sentence = _this.get('sentence');
      var org = (app_state.get('currentUser.organizations') || []).find(function(o) { return o.admin && o.full_manager; });
      if(!sentence) { return; }
      if(org) {
        _this.set('sentence_state', {loading: true});
        persistence.ajax('/api/v1/organizations/' + org.id + '/extra_action', {
          type: 'POST',
          data: {
            extra_action: 'add_sentence_suggestion',
            word: _this.get('model.word'),
            sentence: sentence
          }
        }).then(function(res) {
          _this.set('sentence_state', {});
          _this.set('sentence', '');
          _this.load_part_of_speech();
        }, function(err) {
          _this.set('sentence_state', {error: true});
        });
      } else {
        _this.set('sentence_state', {error: true});
      }
    }
  }
});
