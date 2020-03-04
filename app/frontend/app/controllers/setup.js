import Controller from '@ember/controller';
import EmberObject from '@ember/object';
import { later as runLater } from '@ember/runloop';
import $ from 'jquery';
import i18n from '../utils/i18n';
import persistence from '../utils/persistence';
import CoughDrop from '../app';
import app_state from '../utils/app_state';
import modal from '../utils/modal';
import speecher from '../utils/speecher';
import utterance from '../utils/utterance';
import Utils from '../utils/misc';
import Stats from '../utils/stats';
import { observer } from '@ember/object';
import { computed } from '@ember/object';

var order = ['intro', 'usage', 'board_category', 'core', 'symbols', 'access', 'voice', 'logging', 'supervisors', 'done'];
var extra_order = ['extra-dashboard', 'extra-home-boards', 'extra-speak-mode', 'extra-folders', 'extra-exit-speak-mode', 'extra-modeling', 'extra-supervisors', 'extra-reports', 'extra-logs', 'extra-done'];
export default Controller.extend({
  speecher: speecher,
  title: computed(function() {
    return i18n.t('account_setup', "Account Setup");
  }),
  queryParams: ['page', 'finish'],
  order: order,
  extra_order: extra_order,
  partial: computed('page', function() {
    var page = this.get('page');
    var pages = order.concat(extra_order);
    if(page && page.match(/^extra/)) {
      app_state.controller.set('setup_order', order.concat(extra_order));
    }
    if(pages.indexOf(page) != -1) {
      return "setup/" + page;
    } else {
      return "setup/intro";
    }
  }),
  text_position: computed(
    'fake_user.preferences.device.button_text_position',
    'app_state.currentUser.preferences.device.button_text_position',
    function() {
      var res = {};
      var user = app_state.get('currentUser') || this.get('fake_user');
      if(user.get('preferences.device.button_text_position') == 'top') {
        res.text_on_top = true;
      } else if(user.get('preferences.device.button_text_position') == 'bottom') {
        res.text_on_bottom = true;
      } else if(user.get('preferences.device.button_text_position') == 'text_only') {
        res.text_only = true;
      } else {
        res.text_on_top = true;
      }
      return res;
    }
  ),
  image_preview_class: computed(
    'fake_user.preferences.high_contrast',
    'app_state.currentUser.high_contrast',
    'background',
    function() {
      var res = 'symbol_preview ';
      var user = app_state.get('currentUser') || this.get('fake_user');
      if(user.get('preferences.high_contrast')) {
        res = res + 'high_contrast ';
      }
      if(this.get('background.white')) {
        res = res + 'white ';
      } else if(this.get('background.black') || this.get('background.black_with_high_contrast')) {
        res = res + 'black ';
      }
      return res;
    }
  ),
  background: computed(
    'fake_user.preferences.device.symbol_background',
    'app_state.currentUser.preferences.device.symbol_background',
    'fake_user.preferences.high_contrast',
    'app_state.currentUser.high_contrast',
    function() {
      var res = {};
      var user = app_state.get('currentUser') || this.get('fake_user');
      if(user.get('preferences.device.symbol_background') == 'clear') {
        res.clear = true;
      } else if(user.get('preferences.device.symbol_background') == 'white') {
        res.white = true;
      } else if(user.get('preferences.device.symbol_background') == 'black') {
        if(user.get('preferences.high_contrast')) {
          res.black_with_high_contrast = true;
        } else {
          res.black = true;
        }

      } else {
        res.clear = true;
      }
      return res;
    }
  ),
  access: computed(
    'fake_user.preferences.device.dwell',
    'app_state.currentUser.preferences.device.dwell',
    'fake_user.preferences.device.scanning',
    'app_state.currentUser.preferences.device.scanning',
    function() {
      var res = {};
      var user = app_state.get('currentUser') || this.get('fake_user');
      if(user.get('preferences.device.dwell')) {
        res.dwell = true;
      } else if(user.get('preferences.device.scanning')) {
        res.scanning = true;
      } else {
        res.touch = true;
      }
      return res;
    }
  ),
  home_return: computed(
    'fake_user.preferences.auto_home_return',
    'app_state.currentUser.preferences.auto_home_return',
    function() {
      var res = {};
      var user = app_state.get('currentUser') || this.get('fake_user');
      if(user.get('preferences.auto_home_return')) {
        res.auto_return = true;
      } else {
        res.stay = true;
      }
      return res;
    }
  ),
  symbols: computed(
    'fake_user.preferences.preferred_symbols',
    'app_state.currentUser.preferences.preferred_symbols',
    function() {
      var res = {};
      var user = app_state.get('currentUser') || this.get('fake_user');
      if(user.get('preferences.preferred_symbols')) {
        res[user.get('preferences.preferred_symbols').replace(/-/, '_')] = true;
      } else {
        res.original = true;
      }
      return res;
    }
  ),
  premium_but_not_allowed: computed(
    'app_state.currentUser.subscription.extras_enabled',
    'symbols.pcs',
    'symbols.symbolstix',
    function() {
      return (this.get('symbols.pcs') || this.get('symbols.symbolstix')) && !this.get('app_state.currentUser.subscription.extras_enabled');
    }
  ),
  lessonpix_but_not_allowed: computed('symbols.lessonpix', 'lessonpix_enabled', function() {
    return this.get('symbols.lessonpix') && !this.get('lessonpix_enabled');
  }),
  no_scroll: computed(
    'advanced',
    'page',
    'app_state.feature_flags.board_levels',
    'scroll_disableable',
    function() {
      if(app_state.get('feature_flags.board_levels') && this.get('scroll_disableable')) {
        return !this.get('advanced') && this.get('page') == 'board_category'; 
      } else {
        return false;
      }
    }
  ),
  notification: computed(
    'fake_user.preferences.notification_frequency',
    'app_state.currentUser.preferences.notification_frequency',
    'fake_user.preferences.share_notifications',
    'app_state.currentUser.preferences.share_notifications',
    function() {
      var res = {};
      var user = app_state.get('currentUser') || this.get('fake_user');
      if(user.get('preferences.notification_frequency') == '1_week') {
        res['1_week'] = true;
      } else if(user.get('preferences.notification_frequency') == '2_weeks') {
        res['2_weeks'] = true;
      } else if(user.get('preferences.notification_frequency') == '1_month') {
        res['1_month'] = true;
      } else {
        res['none'] = true;
      }
      if(user.get('preferences.share_notifications') == 'email') {
        res.email = true;
      } else if(user.get('preferences.share_notifications') == 'text') {
        res.text = true;
      } else if(user.get('preferences.share_notifications') == 'app') {
        res.app = true;
      } else {
        res.email = true;
      }
      return res;
    }
  ),
  update_cell: observer(
    'cell',
    'fake_user.cell_phone',
    'app_state.currentUser.cell_phone',
    function(o, change) {
      if(!app_state.controller.get('setup_footer')) { return; }
      var user = app_state.get('currentUser') || this.get('fake_user');
      if(!this.get('cell') && user.get('cell_phone')) {
        this.set('cell', user.get('cell_phone'));
      } else if(change == 'app_state.currentUser.cell_phone') {
        this.set('cell', user.get('cell_phone'));
      } else if(this.get('cell')) {
        user.set('cell_phone', this.get('cell'));
        this.send('set_preference', 'cell_phone', this.get('cell'));
      }
    }
  ),
  update_pin: observer(
    'pin',
    'fake_user.preferences.require_speak_mode_pin',
    'app_state.currentUser.preferences.require_speak_mode_pin',
    'fake_user.preferences.speak_mode_pin',
    'app_state.currentUser.preferences.speak_mode_pin',
    function(o, change) {
      if(!app_state.controller.get('setup_footer')) { return; }
      var user = app_state.get('currentUser') || this.get('fake_user');
      if(!this.get('pin') && user.get('preferences.speak_mode_pin') && user.get('preferences.require_speak_mode_pin')) {
        this.set('pin', user.get('preferences.speak_mode_pin') || "");
      } else if(change == 'app_state.currentUser.preferences.speak_mode_pin') {
        this.set('pin', user.get('preferences.speak_mode_pin') || "");
      } else {
        var pin = (parseInt(this.get('pin'), 10) || "").toString().substring(0, 4);
        var _this = this;
        runLater(function() {
          if(pin != _this.get('pin')) {
            _this.set('pin', pin);
          }
        }, 10);
        if(pin.length == 4 && (!user.get('preferences.require_speak_mode_pin') || pin != user.get('preferences.speak_mode_pin'))) {
          user.set('preferences.require_speak_mode_pin', true);
          this.send('set_preference', 'speak_mode_pin', this.get('pin'));
        } else if(pin.length != 4 && user.get('preferences.require_speak_mode_pin')) {
          this.send('set_preference', 'require_speak_mode_pin', false);
        }
      }
    }
  ),
  update_checkbox_preferences: observer(
    'fake_user.preferences.vocalize_buttons',
    'app_state.currentUser.preferences.vocalize_buttons',
    'vocalize_buttons',
    'fake_user.preferences.vocalize_linked_buttons',
    'app_state.currentUser.preferences.vocalize_linked_buttons',
    'vocalize_linked_buttons',
    'fake_user.preferences.auto_home_return',
    'app_state.currentUser.preferences.auto_home_return',
    'auto_home_return',
    function(a, b, c) {
      if(!app_state.controller.get('setup_footer')) { return; }
      var do_update = false;
      var _this = this;
      if(_this.get('ignore_update')) { return; }

      var user = app_state.get('currentUser') || this.get('fake_user');
      ['vocalize_buttons', 'vocalize_linked_buttons', 'auto_home_return'].forEach(function(pref) {
        if(b && b.match(/fake_user|currentUser/) /*_this.get(pref) == null*/ && user.get('preferences.' + pref) != null) {
          _this.set('ignore_update', true);
          _this.set(pref, user.get('preferences.' + pref));
          _this.set('ignore_update', false);
        } else if(_this.get(pref) != null && _this.get(pref) != user.get('preferences.' + pref)) {
          user.set('preferences.' + pref, _this.get(pref));
          do_update = true;
        }
      });

      if(do_update) {
        this.send('set_preference', 'extra', true);
      }
    }
  ),
  user_voice_list: computed(
    'speecher.voiceList',
    'app_state.currentUser.premium_voices.claimed',
    'fake_user.preferences.device.voice.voice_uri',
    'app_state.currentUser.preferences.device.voice.voice_uris',
    function() {
      var list = speecher.get('voiceList');
      var result = [];
      var user = app_state.get('currentUser') || this.get('fake_user');
      var premium_voice_ids = (user.get('premium_voices.claimed') || []).map(function(id) { return "extra:" + id; });
      var voice_uri = user.get('preferences.device.voice.voice_uri');
      var found = false;
      list.forEach(function(voice) {
        voice = $.extend({}, voice);
        voice.selected = voice.id == voice_uri;
        if(voice.selected) { found = true; }
        if(voice.voiceURI && voice.voiceURI.match(/^extra/)) {
          if(premium_voice_ids.indexOf(voice.voiceURI) >= 0) {
            result.push(voice);
          }
        } else {
          result.push(voice);
        }
      });
      if(result.length > 1) {
        result.push({
          id: 'force_default',
          name: i18n.t('system_default_voice', 'System Default Voice'),
          selected: !found
        });
      }
      return result;
    }
  ),
  update_on_page_change: observer('page', function() {
    if(!this.get('fake_user')) {
      this.set('fake_user', EmberObject.create({
        preferences:
        {
          device: {voice: {}},
          vocalize_buttons: true,
          auto_home_return: true
        }
      }));
    }
    var _this = this;
    if(app_state.get('currentUser')) {
      this.set('cell', app_state.get('currentUser.cell_phone'));
      ['vocalize_buttons', 'vocalize_linked_buttons', 'auto_home_return'].forEach(function(pref) {
        _this.set(pref, app_state.get('currentUser.preferences.' + pref));
      });

      if(this.get('page') == 'symbols') {
        app_state.get('currentUser').find_integration('lessonpix').then(function(res) {
          _this.set('lessonpix_enabled', true);
        }, function(err) { });
      }
    }
    app_state.controller.set('setup_page', this.get('page'));
    if(this.get('page') != 'board_category') {
      this.set('advanced', false);
    }
    var _this = this;
    speecher.stop('all');
    _this.set('reading', false);
    if(!_this.get('reading_disabled')) {
      runLater(function() {
        _this.read_step();
      }, 500);
    }
    $('html,body').scrollTop(0);
  }),
  read_step: function() {
    var _this = this;
    var prompts = [];
    $("#setup_container .prompt").each(function() {
      var sentences = this.innerText.split(/\.\s/);
      sentences.forEach(function(s) {
        if(s) {
          s = s + ".";
          var more_splits = s.split(/\?\s/);
          more_splits.forEach(function(t) {
            prompts.push({text: t + "?"});
          })
        }
      })
      prompts.push({wait: 500});
    });
    console.log("prompt", prompts);
    speecher.stop('all');
    _this.set('reading', true);
    speecher.speak_collection(prompts, "setup-prompt" + Math.random()).then(function() {
      _this.set('reading', false);
    }, function() {
      if(speecher.speaking_from_collection && speecher.speaking_from_collection.match(/^setup-prompt/)) {
      } else {
        _this.set('reading', false);
      }
    });
  },
  actions: {
    set_preference: function(preference, value) {
      var user = app_state.get('currentUser') || this.get('fake_user');
      if(preference == 'access') {
        if(value == 'touch') {
          user.set('preferences.device.dwell', false);
          user.set('preferences.device.scanning', false);
        } else if(value == 'dwell') {
          user.set('preferences.device.dwell', true);
          user.set('preferences.device.scanning', false);
        } else if(value == 'scanning') {
          user.set('preferences.device.dwell', false);
          user.set('preferences.device.scanning', true);
        }
      } else if(preference == 'home_return') {
        if(value == 'auto_return') {
          this.set('auto_home_return', true);
          return;
        } else {
          this.set('auto_home_return', false);
          return;
        }
      } else if(preference == 'preferred_symbols') {
        if(!user.get('original_preferred_symbols')) {
          user.set('original_preferred_symbols', user.get('preferences.preferred_symbols') || 'none')
        }
        user.set('preferences.' + preference, value);
        user.set('preferred_symbols_changed', user.get('preferred_symbols') != user.get('original_preferred_symbols'));
      } else if(preference == 'device.symbol_background') {
        if(value == 'black_with_high_contrast') {
          user.set('preferences.device.symbol_background', 'black');
          user.set('preferences.high_contrast', true);
        } else {
          user.set('preferences.device.symbol_background', value);
          user.set('preferences.high_contrast', false);
        }
      } else {
        user.set('preferences.' + preference, value);
      }
      var _this = this;
      if(preference == 'logging' && value === true && app_state.get('currentUser')) {
        modal.open('enable-logging', {save: true, user: app_state.get('currentUser')});
      }
      if(user.save) {
        app_state.controller.set('footer_status', {message: i18n.t('updating_user', "Updating User...")});
        user.save().then(function() {
          app_state.controller.set('footer_status', null);
          user.reload();
        }, function(err) {
          app_state.controller.set('footer_status', {error: i18n.t('error_updating_user', "Error Updating User")});
        });
      }
    },
    update_scroll: function(val) {
      this.set('scroll_disableable', val);
    },
    toggle_speaking: function() {
      if(this.get('reading')) {
        speecher.stop('all');
        this.set('reading_disabled', true);
        this.set('reading', false);
      } else {
        this.set('reading_disabled', false);
        this.read_step();
      }
    },
    home: function(plus_video) {
      this.transitionToRoute('index');
      if(plus_video) {
        modal.open('inline-video', {video: {type: 'youtube', id: "U1vBg36zVpg"}, hide_overlay: true});
        if(window.ga) {
          window.ga('send', 'event', 'Setup', 'video', 'Setup Video Launched');
        }
      } else {
        if(window.ga) {
          window.ga('send', 'event', 'Setup', 'exit', 'Setup Concluded');
        }
      }
    },
    test_voice: function() {
      var user = app_state.get('currentUser') || this.get('fake_user');
      var voice_uri = user.get('preferences.device.voice.voice_uri');
      utterance.test_voice(voice_uri, app_state.get('currentUser.preferences.device.voice.rate'), app_state.get('currentUser.preferences.device.voice.pitch'), app_state.get('currentUser.preferences.device.voice.volume'));
    },
    manage_supervision: function() {
      modal.open('supervision-settings', {user: app_state.get('currentUser')});
    },
    premium_voices: function() {
      var _this = this;
      modal.open('premium-voices', {user: app_state.get('currentUser')});
    },
    extra: function() {
      app_state.controller.set('setup_order', order.concat(extra_order));
      if(window.ga) {
        window.ga('send', 'event', 'Setup', 'extra', 'Extra Setup Pursued');
      }
      runLater(function() {
        app_state.controller.send('setup_go', 'forward');
      });
    },
    choose_board: function() {
      if(window.ga) {
        window.ga('send', 'event', 'Setup', 'skip', 'Extra Setup Pursued');
      }
      this.transitionToRoute('home-boards');
    },
    show_advanced: function() {
      this.set('advanced', true);
    },
    select_board: function(board) {
      app_state.controller.send('setup_go', 'forward');
    },
    show_more_symbols: function() {
      this.set('showing_more_symbols', true);
    }
  }
});
