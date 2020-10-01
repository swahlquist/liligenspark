import Ember from 'ember';
import {
  later as runLater,
  cancel as runCancel
} from '@ember/runloop';
import RSVP from 'rsvp';
import $ from 'jquery';
import DS from 'ember-data';
import CoughDrop from '../app';
import i18n from '../utils/i18n';
import persistence from '../utils/persistence';
import modal from '../utils/modal';
import app_state from '../utils/app_state';
import Button from '../utils/button';
import editManager from '../utils/edit_manager';
import speecher from '../utils/speecher';
import stashes from '../utils/_stashes';
import capabilities from '../utils/capabilities';
import boundClasses from '../utils/bound_classes';
import word_suggestions from '../utils/word_suggestions';
import ButtonSet from '../models/buttonset';
import Utils from '../utils/misc';
import { htmlSafe } from '@ember/string';
import progress_tracker from '../utils/progress_tracker';
import { observer } from '@ember/object';
import { computed } from '@ember/object';

CoughDrop.Board = DS.Model.extend({
  didLoad: function() {
    this.checkForDataURL().then(null, function() { });
    this.check_for_copy();
    this.clean_license();
  },
  didUpdate: function() {
    this.set('fetched', false);
  },
  name: DS.attr('string'),
  key: DS.attr('string'),
  description: DS.attr('string'),
  created: DS.attr('date'),
  updated: DS.attr('date'),
  user_name: DS.attr('string'),
  locale: DS.attr('string'),
  translated_locales: DS.attr('raw'),
  full_set_revision: DS.attr('string'),
  current_revision: DS.attr('string'),
  for_user_id: DS.attr('string'),
  copy_id: DS.attr('string'),
  source_id: DS.attr('string'),
  image_urls: DS.attr('raw'),
  sound_urls: DS.attr('raw'),
  hc_image_ids: DS.attr('raw'),
  translations: DS.attr('raw'),
  intro: DS.attr('raw'),
  categories: DS.attr('raw'),
  home_board: DS.attr('boolean'),
  has_fallbacks: DS.attr('boolean'),
  valid_id: computed('id', function() {
    return !!(this.get('id') && this.get('id') != 'bad');
  }),
  could_be_in_use: computed('non_author_uses', 'public', 'brand_new', 'stars', function() {
    // no longer using (this.get('public') && this.get('brand_new'))
    return this.get('non_author_uses') > 0 || this.get('non_author_starred');
  }),
  definitely_in_use: computed('non_author_uses', 'stars', function() {
    return this.get('non_author_uses') > 0 || this.get('stars') > 0;
  }),
  fallback_image_url: "https://opensymbols.s3.amazonaws.com/libraries/arasaac/board_3.png",
  key_placeholder: computed('name', function() {
    var key = (this.get('name') || "my-board").replace(/^\s+/, '').replace(/\s+$/, '');
    var ref = key;
    while(key.length < 4) {
      key = key + ref;
    }
    key = key.toLowerCase().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+$/, '').replace(/-+/g, '-');
    return key;
  }),
  icon_url_with_fallback: computed('image_url', function() {
    // TODO: way to fall back to something other than a broken image when disconnected
    if(persistence.get('online')) {
      return this.get('image_data_uri') || this.get('image_url') || this.fallback_image_url;
    } else {
      return this.get('image_data_uri') || this.fallback_image_url;
    }
  }),
  shareable: computed('public', 'permissions.edit', function() {
    return this.get('public') || this.get('permissions.edit');
  }),
  used_buttons: computed('buttons', 'grid', function() {
    var result = [];
    var grid = this.get('grid');
    var buttons = this.get('buttons');
    if(!grid || !buttons) { return []; }
    for(var idx = 0; idx < grid.order[0].length; idx++) {
      for(var jdx = 0; jdx < grid.order.length; jdx++) {
        var id = grid.order[jdx][idx];
        if(id) {
          var button = null;
          for(var kdx = 0; kdx < buttons.length; kdx++) {
            if(buttons[kdx].id == id) {
              result.push(buttons[kdx]);
            }
          }
        }
      }
    }
    return result;
  }),
  labels: computed('buttons', 'grid', function() {
    var list = [];
    this.get('used_buttons').forEach(function(button) {
      if(button && button.label) {
        list.push(button.label);
      }
    });
    return list.join(', ');
  }),
  copy_version: computed('key', function() {
    var key = this.get('key');
    if(key.match(/_\d+$/)) {
      return key.split(/_/).pop();
    } else {
      return null;
    }
  }),
  nothing_visible: computed('buttons', 'grid', function() {
    var found_visible = false;
    this.get('used_buttons').forEach(function(button) {
      if(button && !button.hidden) {
        found_visible = true;
      }
    });
    return !found_visible;
  }),
  map_image_urls: function(map) {
    map = map || {};
    var res = [];
    var locals = this.get('local_images_with_license');
    var local_map = this.get('image_urls') || {};
    this.get('used_buttons').forEach(function(button) {
      if(button && button.image_id) {
        if(local_map[button.image_id]) {
          res.push({id: button.image_id, url: local_map[button.image_id]});
        } else if(map[button.image_id]) {
          res.push({id: button.image_id, url: map[button.image_id]});
        } else {
          var img = locals.find(function(l) { return l.get('id') == button.image_id; });
          if(img) {
            res.push({id: button.image_id, url: img.get('url')});
          } else {
            res.some_missing = true;
          }
        }
      }
    });
    return res;
  },
  local_images_with_license: computed('grid', 'buttons', function() {
    var images = CoughDrop.store.peekAll('image');
    var result = [];
    var missing = false;
    this.get('used_buttons').forEach(function(button) {
      if(button && button.image_id) {
        var image = images.findBy('id', button.image_id.toString());
        if(image) {
          result.push(image);
        } else {
//          console.log('missing image ' + button.image_id);
          missing = true;
        }
      }
    });
    result = result.uniq();
    result.some_missing = missing;
    return result;
  }),
  map_sound_urls: function(map) {
    map = map || {};
    var res = [];
    var locals = this.get('local_sounds_with_license');
    var local_map = this.get('sound_urls') || {};
    this.get('used_buttons').forEach(function(button) {
      if(button && button.sound_id) {
        if(local_map[button.sound_id]) {
          res.push({id: button.sound_id, url: local_map[button.sound_id]});
        } else if(map[button.sound_id]) {
          res.push({id: button.sound_id, url: map[button.sound_id]});
        } else {
          var snd = locals.find(function(l) { return l.get('id') == button.sound_id; });
          if(snd) {
            res.push({id: button.sound_id, url: snd.get('url')});
          } else {
            res.some_missing = true;
          }
        }
      }
    });
    return res;
  },
  local_sounds_with_license: computed('grid', 'buttons', function() {
    var sounds = CoughDrop.store.peekAll('sound');
    var result = [];
    var missing = false;
    this.get('used_buttons').forEach(function(button) {
      if(button && button.sound_id) {
        var sound = sounds.findBy('id', button.sound_id.toString());
        if(sound) {
          result.push(sound);
        } else {
//          console.log('missing sound ' + button.sound_id);
          missing = true;
        }
      }
    });
    result = result.uniq();
    result.some_missing = missing;
    return result;
  }),
  levels: computed('buttons.@each.level_modifications', function() {
    return !!(this.get('buttons') || []).find(function(b) { return b.level_modifications; });
  }),
  has_overrides: computed('buttons.@each.level_modifications', function() {
    return !!this.get('buttons').find(function(b) { return b.level_modifications && b.level_modifications.override; });
  }),
  clear_overrides: function() {
    this.get('buttons').forEach(function(button) {
      if(button && button.level_modifications && button.level_modifications.override) {
        delete button.level_modifications.override;
      }
    })
    return this.save();
  },
  without_lookups: function(callback) {
    this.set('no_lookups', true);
    callback();
    this.set('no_lookups', false);
  },
  locales: computed('translations', 'translated_locales', function() {
    var res = this.get('translated_locales');
    var button_ids = (this.get('translations') || {});
    var all_langs = [];
    for(var button_id in button_ids) {
      if(typeof button_ids[button_id] !== 'string') {
        var keys = Object.keys(button_ids[button_id] || {});
        all_langs = all_langs.concat(keys);
      }
    }
    all_langs.forEach(function(lang) {
      if(res.indexOf(lang) == -1) {
        res.push(lang);
      }
    });
    return res;
  }),
  translations_for_button: function(button_id) {
    // necessary otherwise button that wasn't translated at first will never be translatable
    var trans = (this.get('translations') || {})[button_id] || {};
    (this.get('locales') || []).forEach(function(locale) {
      trans[locale] = trans[locale] || {};
    });
    return trans;
  },
  apply_button_level: function(button, level) {
    var mods = button.level_modifications || {};
    var keys = ['pre'];
    for(var idx = 0; idx <= level; idx++) { keys.push(idx); }
    keys.push('override');
    keys.forEach(function(key) {
      if(mods[key]) {
        for(var attr in mods[key]) {
          button[attr] = mods[key][attr];
        }
      }
    });
    return button;
  },
  translated_buttons: function(label_locale, vocalization_locale) {
    var res = [];
    var trans = this.get('translations') || {};
    var buttons = this.get('buttons') || [];
    if(!trans) { return buttons; }
    var current_locale = this.get('locale') || 'en';
    label_locale = label_locale || trans.current_label || this.get('locale') || 'en';
    vocalization_locale = vocalization_locale || trans.current_vocalization || this.get('locale') || 'en';
    if(trans.current_label == label_locale && trans.current_vocalization == vocalization_locale) { return buttons; }
    var level = this.get('display_level');
    var _this = this;
    buttons.forEach(function(button) {
      var b = $.extend({}, button);
      if(trans[b.id]) {
        if(label_locale != current_locale && trans[b.id][label_locale] && trans[b.id][label_locale].label) {
          b.label = trans[b.id][label_locale].label;
        }
        if(vocalization_locale != current_locale && trans[b.id][vocalization_locale] && (trans[b.id][vocalization_locale].vocalization || trans[b.id][vocalization_locale].label)) {
          b.vocalization = (trans[b.id][vocalization_locale].vocalization || trans[b.id][vocalization_locale].label);
        }
      }
      if(level && level < 10) {
        b = _this.apply_button_level(b, level);
      }
      res.push(b);
    });
    return res;
  },
  contextualized_buttons: function(label_locale, vocalization_locale, history, capitalize) {
    var res = this.translated_buttons(label_locale, vocalization_locale);
    if(app_state.get('speak_mode')) {
      if(label_locale == vocalization_locale) {
        if(app_state.get('referenced_user.preferences.auto_inflections')) {
          var inflection_types = editManager.inflection_for_types(history || [], label_locale);
          res = editManager.update_inflections(res, inflection_types);
        }
      }         
      if(capitalize) {
        // TODO: support capitalization
      }
    }
    return res;
  },
  different_locale: computed('shortened_locale', function() {
    var current = (navigator.language || 'en').split(/[-_]/)[0];
    return current != this.get('shortened_locale');
  }),
  shortened_locale: computed('locale', 'translated_locales', function() {
    var res = (this.get('locale') || 'en').split(/[-_]/)[0];
    if((this.get('translated_locales') || []).length > 1) { res = res + "+"; }
    return res;
  }),
  find_content_locally: function() {
    var _this = this;
    var fetch_promise = this.get('fetch_promise');
    if(this.get('fetched')) { return RSVP.resolve(); }
    if(fetch_promise) { return fetch_promise; }

    if(this.get('no_lookups')) {
      // we don't need to wait on this for an aggressive local load
      return RSVP.resolve(true);
    }

    var promises = [];
    var image_ids = [];
    var sound_ids = [];
    (this.get('buttons') || []).forEach(function(btn) {
      if(btn.image_id) {
        image_ids.push(btn.image_id);
      }
      if(btn.sound_id) {
        sound_ids.push(btn.sound_id);
      }
    });
    promises.push(persistence.push_records('image', image_ids));
    promises.push(persistence.push_records('sound', sound_ids));

    fetch_promise = RSVP.all_wait(promises).then(function() {
      _this.set('fetched', true);
      fetch_promise = null;
      _this.set('fetch_promise', null);
      return true;
    }, function() {
      fetch_promise = null;
      _this.set('fetch_promise', null);
    });
    _this.set('fetch_promise', fetch_promise);
    return fetch_promise;
  },
  set_all_ready: observer(
    'pending_buttons',
    'pending_buttons.[]',
    'pending_buttons.@each.content_status',
    function() {
      var allReady = true;
      if(!this.get('pending_buttons')) { return; }
      this.get('pending_buttons').forEach(function(b) {
        if(b.get('content_status') != 'ready' && b.get('content_status') != 'errored') { allReady = false; }
      });
      this.set('all_ready', allReady);
    }
  ),
  prefetch_linked_boards: function() {
    var boards = this.get('linked_boards');
    runLater(function() {
      var board_ids = [];
      boards.forEach(function(b) { if(b.id) { board_ids.push(b.id); } });
      persistence.push_records('board', board_ids).then(function(boards_hash) {
        for(var idx in boards_hash) {
          if(idx && boards_hash[idx]) {
//            boards_hash[idx].find_content_locally();
          }
        }
      }, function() { });
    }, 500);
  },
  clean_license: function() {
    var _this = this;
    ['copyright_notice', 'source', 'author'].forEach(function(key) {
      if(_this.get('license.' + key + '_link')) {
        _this.set('license.' + key + '_url', _this.get('license.' + key + '_url') || _this.get('license.' + key + '_link'));
      }
      if(_this.get('license.' + key + '_link')) {
        _this.set('license.' + key + '_link', _this.get('license.' + key + '_link') || _this.get('license.' + key + '_url'));
      }
    });
  },
  linked_boards: computed('buttons', function() {
    var buttons = this.get('buttons') || [];
    var result = [];
    for(var idx = 0; idx < buttons.length; idx++) {
      if(buttons[idx].load_board) {
        var board = buttons[idx].load_board;
        if(buttons[idx].link_disabled) {
          board.link_disabled = true;
        }
        result.push(board);
      }
    }
    return Utils.uniq(result, function(r) { return r.id; });
  }),
  unused_buttons: computed('buttons', 'grid', 'grid.order', function() {
    var unused = [];
    var grid = this.get('grid');
    var button_ids = [];
    if(grid && grid.order) {
      for(var idx = 0; idx < grid.order.length; idx++) {
        if(grid.order[idx]) {
          for(var jdx = 0; jdx < grid.order[idx].length; jdx++) {
            button_ids.push(grid.order[idx][jdx]);
          }
        }
      }
    }
    var buttons = this.get('buttons');
    buttons.forEach(function(button) {
      if(button_ids.indexOf(button.id) == -1) {
        unused.push(button);
      }
    });
    return unused;
  }),
  long_preview: computed('name', 'labels', 'user_name', 'created', function() {
    var date = Ember.templateHelpers.date(this.get('created'), 'day');
    var labels = this.get('labels');
    if(labels && labels.length > 100) {
      var new_labels = "";
      var ellipsed = false;
      labels.split(/, /).forEach(function(l) {
        if(new_labels.length === 0) {
          new_labels = l;
        } else if(new_labels.length < 75) {
          new_labels = new_labels + ", " + l;
        } else if(!ellipsed) {
          ellipsed = true;
          new_labels = new_labels + "...";
        }
      });
      labels = new_labels;
    }
    return this.get('key') + " (" + date + ") - " + this.get('user_name') + " - " + labels;
  }),
  search_string: computed('name', 'labels', 'user_name', function() {
    return this.get('name') + " " + this.get('user_name') + " " + this.get('labels');
  }),
  parent_board_id: DS.attr('string'),
  parent_board_key: DS.attr('string'),
  link: DS.attr('string'),
  image_url: DS.attr('string'),
  background: DS.attr('raw'),
  hide_empty: DS.attr('boolean'),
  buttons: DS.attr('raw'),
  grid: DS.attr('raw'),
  license: DS.attr('raw'),
  images: DS.hasMany('image'),
  permissions: DS.attr('raw'),
  copy: DS.attr('raw'),
  copies: DS.attr('number'),
  original: DS.attr('raw'),
  word_suggestions: DS.attr('boolean'),
  public: DS.attr('boolean'),
  visibility: DS.attr('string'),
  brand_new: DS.attr('boolean'),
  protected: DS.attr('boolean'),
  protected_settings: DS.attr('raw'),
  non_author_uses: DS.attr('number'),
  using_user_names: DS.attr('raw'),
  downstream_boards: DS.attr('number'),
  downstream_board_ids: DS.attr('raw'),
  immediately_upstream_boards: DS.attr('number'),
  unlinked_buttons: DS.attr('number'),
  button_levels: DS.attr('raw'),
  forks: DS.attr('number'),
  total_buttons: DS.attr('number'),
  shared_users: DS.attr('raw'),
  sharing_key: DS.attr('string'),
  starred: DS.attr('boolean'),
  stars: DS.attr('number'),
  non_author_starred: DS.attr('boolean'),
  star_or_unstar: function(star) {
    var _this = this;
    console.log(star);
    persistence.ajax('/api/v1/boards/' + this.get('id') + '/stars', {
      type: 'POST',
      data: {
        '_method': (star ? 'POST' : 'DELETE')
      }
    }).then(function(data) {
      _this.set('starred', data.starred);
      _this.set('stars', data.stars);
    }, function() {
      modal.warning(i18n.t('star_failed', "Like action failed"));
    });
  },
  star: function() {
    return this.star_or_unstar(true);
  },
  unstar: function() {
    return this.star_or_unstar(false);
  },
  embed_code: computed('link', function() {
    return "<iframe src=\"" + this.get('link') + "?embed=1\" frameborder=\"0\" style=\"min-width: 640px; min-height: 480px;\"><\\iframe>";

  }),
  check_for_copy: function() {
    // TODO: check local records for a user-specific copy as a fallback in case
    // offline
  },
  multiple_copies: computed('copies', function() {
    return this.get('copies') > 1;
  }),
  visibility_setting: computed('visibility', function() {
    var res = {};
    res[this.get('visibility')] = true;
    return res;
  }),  
  create_copy: function(user, make_public) {
    var board = CoughDrop.store.createRecord('board', {
      parent_board_id: this.get('id'),
      key: this.get('key').split(/\//)[1],
      name: this.get('copy_name') || this.get('name'),
      description: this.get('description'),
      image_url: this.get('image_url'),
      license: this.get('license'),
      word_suggestions: this.get('word_suggestions'),
      public: (make_public || false),
      buttons: this.get('buttons'),
      grid: this.get('grid'),
      categories: this.get('categories'),
      intro: this.get('intro'),
      locale: this.get('locale'),
      translated_locales: this.get('locales'),
      for_user_id: (user && user.get('id')),
      translations: this.get('translations')
    });
    if(board.get('intro')) {
      board.set('intro.unapproved', true);
    }
    this.set('copy_name', null);
    var _this = this;
    var res = board.save();
    res.then(function() {
      _this.rollbackAttributes();
    }, function() { });
    return res;
  },
  add_button: function(button) {
    var buttons = this.get('buttons') || [];
    var new_button = $.extend({}, button.raw());
    new_button.id = button.get('id');
    var collision = false;
    var max_id = 0;
    for(var idx = 0; idx < buttons.length; idx++) {
      if(buttons[idx].id == new_button.id) {
        collision = true;
      }
      max_id = Math.max(max_id, parseInt(buttons[idx].id, 10));
    }
    if(collision || !new_button.id) {
      new_button.id = max_id + 1;
    }
    buttons.push(new_button);
    var grid = this.get('grid');
    var placed = false;
    if(grid && grid.order) {
      for(var idx = 0; idx < grid.order.length; idx++) {
        if(grid.order[idx]) {
          for(var jdx = 0; jdx < grid.order[idx].length; jdx++) {
            if(!grid.order[idx][jdx] && !placed) {
              grid.order[idx][jdx] = new_button.id;
              placed = true;
            }
          }
        }
      }
      this.set('grid', $.extend({}, grid));
    }
    this.set('buttons', [].concat(buttons));
    return new_button.id;
  },
  reload_including_all_downstream: function(affected_board_ids) {
    affected_board_ids = affected_board_ids || [];
    if(affected_board_ids.indexOf(this.get('id')) == -1) {
      affected_board_ids.push(this.get('id'));
    }
    var found_board_ids = [];
    // when a board is copied, we need to reload all the original versions,
    // so if any of them are in-memory or in indexeddb, then we need to
    // reload or fetch them remotely to get the latest, updated version,
    // which will include the "my copy" information.
    CoughDrop.store.peekAll('board').map(function(i) { return i; }).forEach(function(brd) {
      if(brd && affected_board_ids && affected_board_ids.indexOf(brd.get('id')) != -1) {
        if(!brd.get('isLoading') && !brd.get('isNew') && !brd.get('isDeleted')) {
          brd.reload(true);
        }
        found_board_ids.push(brd.get('id'));
      }
    });
    affected_board_ids.forEach(function(id) {
      if(found_board_ids.indexOf(id) == -1) {
        persistence.find('board', id).then(function() {
          CoughDrop.store.findRecord('board', id).then(null, function() { });
        }, function() { });
      }
    });
  },
  button_visible: function(button_id) {
    var grid = this.get('grid');
    if(!grid || !grid.order) { return false; }
    for(var idx = 0; idx < grid.order.length; idx++) {
      if(grid.order[idx]) {
        for(var jdx = 0; jdx < grid.order[idx].length; jdx++) {
          if(grid.order[idx][jdx] == button_id) {
            return true;
          }
        }
      }
    }
    return false;
  },
  checkForDataURL: function() {
    this.set('checked_for_data_url', true);
    var url = this.get('icon_url_with_fallback');
    var _this = this;
    if(!this.get('image_data_uri') && url && url.match(/^http/)) {
      return persistence.find_url(url, 'image').then(function(data_uri) {
        _this.set('image_data_uri', data_uri);
        return _this;
      });
    } else if(url && url.match(/^data/)) {
      return RSVP.resolve(this);
    }
    var url = this.get('background.image');
    if(!this.get('background_image_data_uri') && url && url.match(/^http/)) {
      persistence.find_url(url, 'image').then(function(data_uri) {
        _this.set('background_image_data_uri', data_uri);
        return _this;
      });
    }
    var url = this.get('background.prompt.sound');
    if(!this.get('background_sound_data_uri') && url && url.match(/^http/)) {
      persistence.find_url(url, 'sound').then(function(data_uri) {
        _this.set('background_sound_data_uri', data_uri);
        return _this;
      });
    }
    return RSVP.reject('no board data url');
  },
  background_image_url_with_fallback: computed('background.image', 'background_image_data_uri', function() {
    return this.get('background_image_data_uri') || this.get('background.image');
  }),
  background_sound_url_with_fallback: computed('background_sound_data_uri', 'background.prompt.sound', function() {
    return this.get('background_sound_data_uri') || this.get('background.prompt.sound');
  }),
  has_background: computed('background.image', 'background.text', function() {
    return this.get('background.image') || this.get('background.text');
  }),
  checkForDataURLOnChange: observer('image_url', 'background.image', function() {
    this.checkForDataURL().then(null, function() { });
  }),
  prompt: function(action) {
    var _this = this;
    if(action == 'clear') {
      if(_this.get('reprompt_wait')) {
        runCancel(_this.get('reprompt_wait'));
        _this.set('reprompt_wait', null);
      }
    } else {
      // TODO: schedule a delay and then re-prompt if any delay prompts are set
      var text = _this.get('background.prompt.text');
      if(action == 'reprompt' && _this.get('background.delay_prompts.length') > 0) {
        var idx = _this.get('prompt_index') || 0;
        text = _this.get('background.delay_prompts')[idx % _this.get('background.delay_prompts.length')];
        idx++;
        _this.set('prompt_index', idx);
      }
      if(_this.get('background.prompt.text')) {
        speecher.speak_text(text, false, {alternate_voice: speecher.alternate_voice});
      }
      if(_this.get('background.prompt.sound_url') && action != 'reprompt') {
        speecher.speak_audio(_this.get('background_sound_url_with_fallback'), 'background', false, {loop: _this.get('background.prompt.loop')});
      }
      if(_this.get('background.delay_prompt_timeout') && _this.get('background.delay_prompt_timeout') > 0) {
        if(_this.get('reprompt_wait')) {
          runCancel(_this.get('reprompt_wait'));
          _this.set('reprompt_wait', null);
        }
        _this.set('reprompt_wait', runLater(function() {
          _this.prompt('reprompt');
        }, _this.get('background.delay_prompt_timeout')));
      }
    }
  },
  for_sale: computed('protected', 'protected_settings', function() {
    if(this.get('protected')) {
      var settings = this.get('protected_settings') || {};
      if(settings.cost) {
        return true;
      } else if(settings.root_board) {
        return true;
      }
    }
    return false;
  }),
  protected_material: computed(
    'protected',
    'local_images_with_license',
    'local_sounds_with_license',
    function() {
      var protect = !!this.get('protected');
      if(protect) { return true; }
      (this.get('local_images_with_license') || []).forEach(function(image) {
        if(image && image.get('protected')) {
          protect = true;
        }
      });
      if(protect) { return true; }
      (this.get('local_sounds_with_license') || []).forEach(function(sound) {
        if(sound && sound.get('protected')) {
          protect = true;
        }
      });
      return !!protect;
    }
  ),
  no_sharing: computed('protected_sources', function() {
    return !!this.get('protected_sources.board');
  }),
  protected_sources: computed('protected_material', 'protected_settings', function() {
    var res = {};
    if(this.get('protected_material')) {
      if(this.get('protected_settings.media')) {
        (this.get('protected_settings.media_sources') || ['lessonpix']).forEach(function(key) {
          res[key] = true;
        });
      }
      if(this.get('protected_settings.vocabulary')) {
        res.board = true;
      }
    }
    res.list = Object.keys(res);
    return res;
  }),
  load_button_set: function(force) {
    var _this = this;
    if(this.get('button_set_needs_reload')) {
      force = true;
      this.set('button_set_needs_reload', null);
    }
    if(this.get('button_set') && !force) {
      return this.get('button_set').load_buttons();
    }
    if(this.get('local_only')) { 
      var res = RSVP.reject({error: 'board is local only'}); 
      res.then(null, function() { });
      return res;
    }
    if(!this.get('id')) { return RSVP.reject({error: 'board has no id'}); }
    var button_set = CoughDrop.store.peekRecord('buttonset', this.get('id'));
    if(button_set && !force) {
      this.set('button_set', button_set);
      return button_set.load_buttons();
    } else {
      var valid_button_set = null;
      var button_sets = CoughDrop.store.peekAll('buttonset').map(function(i) { return i; }).forEach(function(bs) {
        if(bs && (bs.get('board_ids') || []).indexOf(_this.get('id')) != -1) {
          if(bs.get('fresh') || !valid_button_set) {
            valid_button_set = bs;
          }
        }
      });
      if(valid_button_set && !force) {
        if(!_this.get('fresh') || valid_button_set.get('fresh')) {
          _this.set('button_set', valid_button_set);
          return valid_button_set.load_buttons();
        } else{
        }
      }
      // first check if there's a satisfactory higher-level buttonset that can be used instead
      var res = CoughDrop.Buttonset.load_button_set(this.get('id'), force).then(function(button_set) {
        _this.set('button_set', button_set);
        if((_this.get('fresh') || force) && !button_set.get('fresh')) {
          return button_set.reload().then(function(bs) { return bs.load_buttons(force); });
        } else {
          return button_set;
        }
      });
      res.then(null, function() { });
      return res;
    }
  },
  load_real_time_inflections: function() {
    var history = stashes.get('working_vocalization') || [];
    var buttons = this.contextualized_buttons(app_state.get('label_locale'), app_state.get('vocalization_locale'), history, false);
    var lbls_tmp = document.getElementsByClassName('tweaked_label');
    var lbls = [];
    for(var idx = 0; idx < lbls_tmp.length; idx++) {
      lbls.push(lbls_tmp[idx]);
    }
    lbls.forEach(function(lbl) {
      if(lbl.classList.contains('button-label')) {
        lbl.innerText = lbl.getAttribute('original-text');
        lbl.classList.remove('tweaked_label');
      }
    });
    var _this = this;
    buttons.forEach(function(button) {
      if(button.tweaked) {
        console.log("CHANGE BUTTON", button);
        _this.update_suggestion_button(button, {
          temporary: true,
          word: (history.length == 0 ? button.original_label : button.label)
        });
      }
    });
  },
  load_word_suggestions: function(board_ids) {
    var working = [].concat(stashes.get('working_vocalization') || []);
    var in_progress = null;
    if(working.length > 0 && working[working.length - 1].in_progress) {
      in_progress = working.pop().label;
    }
    var last_word = ((working[working.length - 1]) || {}).label;
    var second_to_last_word = ((working[working.length - 2]) || {}).label;

    var _this = this;
    var has_suggested_buttons = false;
    var buttons = {};
    var skip_labels = {};
    var known_buttons = this.contextualized_buttons(app_state.get('label_locale'), app_state.get('vocalization_locale'), history, false) || [];
    known_buttons.forEach(function(button) {
      if(button.vocalization == ':suggestion') {
        buttons[button.id.toString()] = button;
        has_suggested_buttons = true;
      } else if(button.label && !button.vocalization && !button.load_board) {
        skip_labels[button.label.toLowerCase()] = true;
      }
    });
    if(!has_suggested_buttons) {
      return null;
    }
    var suggested_buttons = [];
    var order = this.get('grid.order') || [];
    for(var idx = 0; idx < order.length; idx++) {
      for(var jdx = 0; jdx < (order[idx] || []).length; jdx++) {
        if(order[idx][jdx]) {
          var button = buttons[order[idx][jdx].toString()];
          if(button && button.vocalization == ':suggestion') {
            suggested_buttons.push(button);
          }
        }
      }
    }
    if(suggested_buttons.length == 0) { return null; }
    word_suggestions.lookup({
      last_finished_word: last_word || "",
      second_to_last_word: second_to_last_word,
      word_in_progress: in_progress,
      board_ids: board_ids,
      max_results: suggested_buttons.length * 2
    }).then(function(result) {
      var unique_result = (result || []).filter(function(sugg) { return sugg.word && !skip_labels[sugg.word.toLowerCase()]; });
      result = unique_result.concat(result).uniq();
      (result || []).forEach(function(sugg, idx) {
        if(suggested_buttons[idx]) {
          var suggestion_button = suggested_buttons[idx];
          _this.update_suggestion_button(suggestion_button, sugg);
          sugg.image_update = function() {
            persistence.find_url(sugg.image, 'image').then(function(data_uri) {
              sugg.data_image = data_uri;
              _this.update_suggestion_button(suggestion_button, sugg);
            }, function() {
              _this.update_suggestion_button(suggestion_button, sugg);
            });
          };
        }
      });
    }, function() { });
  },
  update_suggestion_button: function(button, suggestion) {
    var _this = this;
    var lookups = _this.get('suggestion_lookups') || {};
    var brds = document.getElementsByClassName('board');
    var font_family = Button.style(app_state.get('currentUser.preferences.device.button_style')).font_family;
    for(var idx = 0; idx < brds.length; idx++) {
      var brd = brds[idx];
      if(brd && brd.getAttribute('data-id') == _this.get('id')) {
        var btns = brd.getElementsByClassName('button');
        for(var jdx = 0; jdx < btns.length; jdx++) {
          var btn = btns[jdx];
          if(btn && btn.getAttribute('data-id') == button.id.toString() && !btn.classList.contains('clone')) {
            // set the values in the DOM, and save them in a lookup
            var url = null;
            if(!suggestion.temporary) {
              lookups[button.id.toString()] = suggestion;
              url = suggestion.data_image || suggestion.image;
              if(persistence.url_cache[url]) {
                url = persistence.url_cache[url];
              }
            }
            var lbl = btn.getElementsByClassName('button-label')[0];
            var img = btn.getElementsByClassName('symbol')[0]
            if(lbl && lbl.tagName != 'INPUT') {
              if(!lbl.getAttribute('original-text')) {
                lbl.setAttribute('original-text', button.original_label || lbl.innerText);
              }
              lbl.classList.add('tweaked_label');
              lbl.innerText = app_state.get('speak_mode') ? suggestion.word : button.label;
              if(button.text_only) {
                var width = parseInt(btn.style.width, 10);
                var height = parseInt(btn.style.height, 10);
                var fit = capabilities.fit_text(lbl.innerText, font_family || 'Arial', width, height, 10);
                if(fit.any_fit) {
                  lbl.style.fontSize = fit.size + "px";
                }
              }
            }
            if(img && url) {
              if(!img.getAttribute('original-src')) {
                img.setAttribute('original-src', img.src);
              }
              img.src = app_state.get('speak_mode') ? url : (img.getAttribute('original-src') || url);
            }
          }
        }
      }
    }
    _this.set('suggestion_lookups', lookups);

  },
  add_classes: function() {
    if(this.get('classes_added')) { return; }
    (this.get('buttons') || []).forEach(function(button) {
      boundClasses.add_rule(button);
      boundClasses.add_classes(button);
    });
    this.set('classes_added', true);
  },
  render_fast_html: function(size) {
    CoughDrop.log.track('redrawing');

    var buttons = this.contextualized_buttons(app_state.get('label_locale'), app_state.get('vocalization_locale'), stashes.get('working_vocalization'), false);
    var grid = this.get('grid');
    var ob = [];
    for(var idx = 0; idx < grid.rows; idx++) {
      var row = [];
      for(var jdx = 0; jdx < grid.columns; jdx++) {
        var found = false;
        for(var kdx = 0; kdx < buttons.length; kdx++) {
          if(buttons[kdx] && buttons[kdx].id && buttons[kdx].id == (grid.order[idx] || [])[jdx]) {
            found = true;
            var btn = $.extend({}, buttons[kdx]);
            row.push(btn);
          }
        }
        if(!found) {
          row.push({
            empty: true,
            label: '',
            id: -1
          });
        }
      }
      ob.push(row);
    }

    var starting_height = Math.floor((size.height / (grid.rows || 2)) * 100) / 100;
    var starting_width = Math.floor((size.width / (grid.columns || 2)) * 100) / 100;
    var extra_pad = size.extra_pad;
    var inner_pad = size.inner_pad;
    var double_pad = inner_pad * 2;
    var radius = 4;
    var context = null;

    var currentLabelHeight = size.base_text_height - 3;
    this.set('text_size', 'normal');
    if(starting_height < 35) {
      this.set('text_size', 'really_small_text');
    } else if(starting_height < 75) {
      this.set('text_size', 'small_text');
    }

    var _this = this;

    var button_html = function(button, pos) {
      var res = "";

      var local_image_url = persistence.url_cache[(_this.get('image_urls') || {})[button.image_id] || 'none'] || (_this.get('image_urls') || {})[button.image_id] || 'none';
      var hc = !!(_this.get('hc_image_ids') || {})[button.image_id];
      var local_sound_url = persistence.url_cache[(_this.get('sound_urls') || {})[button.sound_id] || 'none'] || (_this.get('sound_urls') || {})[button.sound_id] || 'none';
      var opts = Button.button_styling(button, _this, pos);

      res = res + "<a href='#' style='" + opts.button_style + "' class='" + opts.button_class + "' data-id='" + button.id + "' tabindex='0'>";
      res = res + "<div class='" + opts.action_class + "'>";
      res = res + "<span class='action'>";
      res = res + "<img src='" + opts.action_image + "' draggable='false' alt='" + opts.action_alt + "' />";
      res = res + "</span>";
      res = res + "</div>";

      res = res + "<span style='" + opts.image_holder_style + "'>";
      if(!app_state.get('currentUser.hide_symbols') && local_image_url && local_image_url != 'none' && !_this.get('text_only') && !button.text_only) {
        res = res + "<img src=\"" + Button.clean_url(local_image_url) + "\" onerror='button_broken_image(this);' draggable='false' style='" + opts.image_style + "' class='symbol " + (hc ? ' hc' : '') + "' />";
      }
      res = res + "</span>";
      if(button.sound_id && local_sound_url && local_sound_url != 'none') {
        var rel_url = Button.clean_url(_this.get('sound_urls')[button.sound_id]);
        var url = Button.clean_url(local_sound_url);
        res = res + "<audio style='display: none;' preload='auto' src=\"" + url + "\" rel=\"" + rel_url + "\"></audio>";
      }
      var button_class = button.text_only ? size.text_only_button_symbol_class : size.button_symbol_class;
      var txt = Button.clean_text(opts.label);
      var text_style = '';
      var holder_style = '';
      if(button.text_only) {
        var fit = capabilities.fit_text(txt, (pos.font_family || opts.font_family || 'Arial'), pos.width, pos.height, 10);
        if(fit.any_fit) {
          text_style = "style='font-size: " + fit.size + "px;'";
          holder_style = "style='position: absolute;'";
        }
      }

      res = res + "<div class='" + button_class + "' " + holder_style + ">";
      res = res + "<span " + text_style + "class='button-label " + (button.hide_label ? "hide-label" : "") + "'>" + txt + "</span>";
      res = res + "</div>";

      res = res + "</a>";
      return res;
    };
    var html = "";

    var text_position = "text_position_" + (app_state.get('currentUser.preferences.device.button_text_position') || window.user_preferences.device.button_text_position);
    if(this.get('text_only')) { text_position = "text_position_text_only"; }

    CoughDrop.log.track('computing dimensions');
    ob.forEach(function(row, i) {
      html = html + "\n<div class='button_row fast'>";
      row.forEach(function(button, j) {
        boundClasses.add_rule(button);
        if(size.display_level && button.level_modifications) {
          var do_show = false;
          if(do_show && size.display_level == _this.get('default_level')) {
          } else {
            var mods = button.level_modifications;
            var level = size.display_level;
            // console.log("mods at", mods, level);
            if(mods.override) {
              for(var key in mods.override) {
                button[key] = mods.override[key];
              }
            }
            if(mods.pre) {
              for(var key in mods.pre) {
                if(!mods.override || !mods.override[key]) {
                  button[key] = mods.pre[key];
                }
              }
            }
            for(var idx = 1; idx <= level; idx++) {
              if(mods[idx]) {
                for(var key in mods[idx]) {
                  if(!mods.override || !mods.override[key]) {
                    button[key] = mods[idx][key];
                  }
                }
              }
            }
          }
        }
        boundClasses.add_classes(button);
        var button_height = starting_height - (extra_pad * 2);
        var button_width = starting_width - (extra_pad * 2);
        var top = extra_pad + (i * starting_height);
        var left = extra_pad + (j * starting_width) - 2;

        var image_height = button_height - currentLabelHeight - CoughDrop.boxPad - (inner_pad * 2) + 8;
        var image_width = button_width - CoughDrop.boxPad - (inner_pad * 2) + 8;

        var top_margin = currentLabelHeight + CoughDrop.labelHeight - 8;
        if(_this.get('text_size') == 'really_small_text') {
          if(currentLabelHeight > 0) {
            image_height = image_height + currentLabelHeight - CoughDrop.labelHeight + 25;
            top_margin = 0;
          }
        } else if(_this.get('text_size') == 'small_text') {
          if(currentLabelHeight > 0) {
            image_height = image_height + currentLabelHeight - CoughDrop.labelHeight + 10;
            top_margin = top_margin - 10;
          }
        }
        if(button_height < 50) {
          image_height = image_height + (inner_pad * 2);
        }
        if(button_width < 50) {
          image_width = image_width + (inner_pad * 2) + (extra_pad * 2);
        }
        if(currentLabelHeight === 0 || text_position != 'text_position_top') {
          top_margin = 0;
        }

        html = html + button_html(button, {
          top: top,
          left: left,
          width: Math.floor(button_width),
          height: Math.floor(button_height),
          image_height: image_height,
          image_width: image_width,
          image_square: Math.min(image_height, image_width),
          image_top_margin: top_margin,
          border: inner_pad
        });
      });
      html = html + "\n</div>";
    });
    return {
      width: size.width,
      height: size.height,
      label_locale: size.label_locale,
      display_level: size.display_level,
      revision: _this.get('current_revision'),
      html: htmlSafe(html)
    };
  }
});

CoughDrop.Board.reopenClass({
  clear_fast_html: function() {
    CoughDrop.store.peekAll('board').forEach(function(b) {
      b.set('fast_html', null);
    });
    if(app_state.get('currentBoardState.id') && editManager.controller && !editManager.controller.get('ordered_buttons')) {
      editManager.process_for_displaying();
    }
  },
  refresh_data_urls: function() {
    // when you call sync, you're potentially prefetching a bunch of images and
    // sounds that don't have a locally-stored copy yet, so their data-uris will
    // all come up empty. But then if you open one of those boards without
    // refreshing the page, they're stored in the ember-data cache without a
    // data-uri so they fail if you go offline, even though they actually
    // got persisted to the local store. This method tried to address that
    // shortcoming.
    var _this = this;
    runLater(function() {
      CoughDrop.store.peekAll('board').map(function(i) { return i; }).forEach(function(i) {
        if(i) {
          i.checkForDataURL().then(null, function() { });
        }
      });
      CoughDrop.store.peekAll('image').map(function(i) { return i; }).forEach(function(i) {
        if(i) {
          i.checkForDataURL().then(null, function() { });
        }
      });
      CoughDrop.store.peekAll('sound').map(function(i) { return i; }).forEach(function(i) {
        if(i) {
          i.checkForDataURL().then(null, function() { });
        }
      });
    });
  },
  mimic_server_processing: function(record, hash) {
    if(hash.board.id.match(/^tmp/)) {
      var splits = (hash.board.key || hash.board.id).split(/\//);
      var key = splits[1] || splits[0];
      var rnd = "tmp_" + Math.round(Math.random() * 10000).toString() + (new Date()).getTime().toString();
      hash.board.key = rnd + "/" + key;
    }
    hash.board.permissions = {
      "view": true,
      "edit": true
    };

    hash.board.buttons = hash.board.buttons || [];
    delete hash.board.images;
    hash.board.grid = {
      rows: (hash.board.grid && hash.board.grid.rows) || 2,
      columns: (hash.board.grid && hash.board.grid.columns) || 4,
      order: (hash.board.grid && hash.board.grid.order) || []
    };
    for(var idx = 0; idx < hash.board.grid.rows; idx++) {
      hash.board.grid.order[idx] = hash.board.grid.order[idx] || [];
      for(var jdx = 0; jdx < hash.board.grid.columns; jdx++) {
        hash.board.grid.order[idx][jdx] = hash.board.grid.order[idx][jdx] || null;
      }
      if(hash.board.grid.order[idx].length > hash.board.grid.columns) {
        hash.board.grid.order[idx] = hash.board.grid.order[idx].slice(0, hash.board.grid.columns);
      }
    }
    if(hash.board.grid.order.length > hash.board.grid.rows) {
      hash.board.grid.order = hash.board.grid.order.slice(0, hash.board.grid.rows);
    }
    return hash;
  }
});

export default CoughDrop.Board;
