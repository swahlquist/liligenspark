import Controller from '@ember/controller';
import CoughDrop from '../app';
import persistence from '../utils/persistence';
import app_state from '../utils/app_state';
import session from '../utils/session';
import i18n from '../utils/i18n';

export default Controller.extend({
  title: function() {
    return "Search results for " + this.get('searchString');
  }.property('searchString'),
  locales: function() {
    var list = i18n.get('translatable_locales');
    var res = [{name: i18n.t('choose_locale', '[Choose a Language]'), id: ''}];
    for(var key in list) {
      res.push({name: list[key], id: key});
    }
    res.push({name: i18n.t('any_language', "Any Language"), id: 'any'});
    return res;
  }.property(),
  load_results: function(str) {
    var _this = this;
    this.set('online_results', {loading: true, results: []});
    this.set('local_results', {loading: true, results: []});

    if(session.get('isAuthenticated')) {
      persistence.find_boards(str).then(function(res) {
        _this.set('local_results', {results: res});
      }, function() { _this.set('local_results', {results: []}); });
    } else {
      _this.set('local_results', {impossible: true});
    }

    function loadBoards() {
      if(persistence.get('online')) {
        _this.set('online_results', {loading: true, results: []});
        _this.set('personal_results', {loading: true, results: []});
        var locale = (_this.get('locale') || window.navigator.language || 'en').split(/-/)[0];
        CoughDrop.store.query('board', {q: str, locale: locale, sort: 'popularity'}).then(function(res) {
          _this.set('online_results', {results: res.map(function(i) { return i; })});
        }, function() {
          _this.set('online_results', {results: []});
        });
        if(app_state.get('currentUser')) {
          CoughDrop.store.query('board', {q: str, user_id: 'self'}).then(function(res) {
            _this.set('personal_results', {results: res.map(function(i) { return i; })});
          }, function() {
            _this.set('personal_results', {results: []});
          });
        } else{
          _this.set('personal_results', {results: []});
        }
      } else {
        _this.set('online_results', {results: []});
        _this.set('personal_results', {results: []});
      }
    }
    loadBoards();

    persistence.addObserver('online', function() {
      loadBoards();
    });

  },
  actions: {
    searchBoards: function() {
      this.load_results(this.get('searchString'));
      this.transitionToRoute('search', this.get('locale'), encodeURIComponent(this.get('searchString') || '_'));
    }
  }
});

