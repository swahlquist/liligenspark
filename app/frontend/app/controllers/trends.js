import Controller from '@ember/controller';
import EmberObject from '@ember/object';
import { later as runLater } from '@ember/runloop';
import i18n from '../utils/i18n';
import persistence from '../utils/persistence';
import app_state from '../utils/app_state';
import modal from '../utils/modal';
import { computed } from '@ember/object';

export default Controller.extend({
  load_trends: function() {
    var _this = this;
    _this.set('trends', {loading: true});
    persistence.ajax('/api/v1/logs/trends', {type: 'GET'}).then(function(res) {
      _this.set('trends', res);
    }, function(err) {
      _this.set('trends', {error: true});
    });
    runLater(function() {
      _this.set('word_cloud_id', Math.random());
    }, 2000);
  },
  word_cloud_stats: computed('trends.word_counts', function() {
    var res = EmberObject.create({
      words_by_frequency: []
    });
    var counts = this.get('trends.word_counts') || {};
    for(var idx in counts) {
      res.get('words_by_frequency').pushObject({text: idx, count: counts[idx]});
    }
    return res;
  }),
  home_boards: computed('trends.home_boards', function() {
    var hash = this.get('trends.home_boards');
    if(hash) {
      var res = [];
      for(var idx in hash) {
        res.push({key: idx, pct: Math.round(hash[idx] * 100 * 10) / 10});
      }
      return res.sort(function(a, b) {
        return b.pct - a.pct;
      });
    }
  }),
  board_locales: computed('trends.board_locales', 'showing_private_info', function() {
    var hash = this.get('trends.board_locales');
    var tally = this.get('trends.max_board_locales_count') || 1000;
    if(hash) {
      var res = [];
      for(var idx in hash) {
        res.push({key: idx, pct: (hash[idx] * tally)});
      }
      res = res.sort(function(a, b) {
        return b.pct - a.pct;
      });
      res = res.slice(0, 50);
      return res;
    }
  }),
  compute_breakdown(attr, max) {
    var res = [];
    var systems = attr || {};
    var total = 0;
    var max_value = attr['max_value'] || max;
    for(var idx in systems) {
      if(idx != 'max_value' && systems[idx] != null) {
        total = total + systems[idx];
      }
    }
    for(var idx in systems) {
      if(idx != 'max_value' && systems[idx] != null) {
        var pct =  Math.round(systems[idx] / total * 100);
        if(pct < 1) { pct = "<1"; }
          var obj = {
          name: idx,
          num: systems[idx] || 0,
          percent: pct
        };
        if(max_value) {
          obj.total = Math.round(systems[idx] * max_value);
        }
        res.push(obj);
      }
    }
    return res.sort(function(a, b) { return b.num - a.num; });
  },
  auto_home_pct: computed('trends.device.auto_home_returns', function() {
    var trues = this.get('trends.device.auto_home_returns.true') || 0;
    var falses = this.get('trends.device.auto_home_returns.false') || 0;
    var sum = trues + falses;
    if(sum == 0)  { sum = 1; }
    return Math.round((trues / sum) * 1000) / 10;
  }),
  touch_pct: computed('trends.device.access_methods', function() {
    var touch = 0;
    var all = 0;
    var methods = this.get('trends.device.access_methods');
    for(var idx in methods) {
      if(idx != 'max_value')  {
        all = all + methods[idx];
        if(idx == 'touch') {
          touch = touch + methods[idx];
        }
      }
    }
    if(all == 0) { all = 1; }
    return Math.round((touch / all) * 1000) / 10;
  }),
  systems: computed('trends.device.systems', function() {
    return this.compute_breakdown(this.get('trends.device.systems') || {});
  }),
  access_methods: computed('trends.device.access_methods', function() {
    return this.compute_breakdown(this.get('trends.device.access_methods') || {});
  }),
  locales: computed('trends.board_locales', function() {
    var res = this.compute_breakdown(this.get('trends.board_locales') || {}, this.get('trends.max_board_locales_count'));
    res.forEach(function(loc) {
      loc.locale = loc.name;
      loc.name = i18n.locales[loc.locale] || loc.locale;
    });
  }),
  voices: computed('trends.device.voice_uris', function() {
    return this.compute_breakdown(this.get('trends.device.voice_uris') || {});
  }),
  depths: computed('trends.depth_counts', function() {
    var res = this.compute_breakdown(this.get('trends.depth_counts') || {}, this.get('trends.max_depth_count'));
    var lows = 0;
    res.forEach(function(d) {
      d.level = parseInt(d.name);
      if(d.pct == "<1") {
        lows++;
      }
      if(lows > 5) { d.skip = true; }
    });
    return res.filter(function(d) { return !d.skip; });
  }),
  words: computed('trends.word_counts', 'trends.word_travels', 'trends.available_words', function() {
    var res = [];
    var counts = this.get('trends.word_counts') || {};
    var travels = this.get('trends.word_travels') || {};
    var available  = this.get('trends.available_words') || {};
    for(var word in counts) {
      var wrd = {name: word};
      wrd.pct = counts[word] * 100.0;
      wrd.available = (available[word] || 0) * 100.0;
      wrd.travel = travels[word] || 0;
      res.push(wrd);
    }
    res = res.sort(function(a, b) { return b.pct - a.pct; }).reverse().slice(200);
    return res;
  }),
  word_pairs: computed('trends.word_pairs', 'showing_private_info', function() {
    var res = [];
    var pairs = this.get('trends.word_pairs') || {};
    for(var idx in pairs) {
      var pair = pairs[idx];
      pair.num = pair.percent;
      pair.pct = Math.round(pair.percent * 1000) / 10;
      res.push(pair);
    }
    res = res.sort(function(a, b) { return b.num - a.num; })
    if(!this.get('showing_private_info')) {
      res = res.slice(0, 10);
    }
    return res;
  }),
  common_boards: computed('trends.board_usages', 'showing_private_info', function() {
    var hash = this.get('trends.board_usages');
    var tally = this.get('trends.max_board_usage_count') || 1000;
    if(hash) {
      var res = [];
      for(var idx in hash) {
        res.push({key: idx, pct: Math.round(hash[idx] * tally)});
      }
      res = res.sort(function(a, b) {
        return b.pct - a.pct;
      });
      if(this.get('showing_private_info')) {
        res = res.slice(0, 200);
      } else {
        res = res.slice(0, 25);
      }
      return res;
    }
  }),
  actions: {
    show_private_info: function() {
      this.set('showing_private_info', true);
    }
  }
});
