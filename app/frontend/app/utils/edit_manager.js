import EmberObject from '@ember/object';
import { set as emberSet, get as emberGet } from '@ember/object';
import { later as runLater } from '@ember/runloop';
import $ from 'jquery';
import RSVP from 'rsvp';
import CoughDrop from '../app';
import Button from './button';
import stashes from './_stashes';
import app_state from './app_state';
import contentGrabbers from './content_grabbers';
import modal from './modal';
import persistence from './persistence';
import progress_tracker from './progress_tracker';
import word_suggestions from './word_suggestions';
import i18n from './i18n';
import { observer } from '@ember/object';

var editManager = EmberObject.extend({
  setup: function(board) {
    editManager.Button = Button;
    this.controller = board;
    this.set('app_state', app_state);
    if(app_state.controller) {
      app_state.controller.addObserver('dragMode', function() {
        if(editManager.controller == board) {
          var newMode = app_state.controller.get('dragMode');
          if(newMode != editManager.dragMode) {
            editManager.set('dragMode', newMode);
          }
        }
      });
    }
    this.set('dragMode', false);
    var edit = stashes.get('current_mode') == 'edit';
    if(this.auto_edit.edits && this.auto_edit.edits[board.get('model.id')]) {
      edit = true;
      this.auto_edit.edits[board.get('model.id')] = false;
      stashes.persist('current_mode', 'edit');
    }
    this.swapId = null;
    this.stashedButtonToApply = null;
    this.clear_history();
  },
  set_drag_mode: function(enable) {
    if(app_state.controller) {
      app_state.controller.set('dragMode', enable);
    }
  },
  edit_mode_triggers: observer('app_state.edit_mode', function() {
    if(this.controller && this.lucky_symbol.pendingSymbols && app_state.get('edit_mode')) {
      this.lucky_symbols(this.lucky_symbol.pendingSymbols);
      this.lucky_symbol.pendingSymbols = [];
    }

  }),
  long_press_mode: function(opts) {
    var app = app_state.controller;
    if(!app_state.get('edit_mode')) {
      if(opts.button_id && app_state.get('speak_mode') && app_state.get('currentUser.preferences.long_press_edit_disabled')) {
        if(app_state.get('speak_mode') && app_state.get('currentUser.preferences.require_speak_mode_pin') && app_state.get('currentUser.preferences.speak_mode_pin')) {
          modal.open('speak-mode-pin', {actual_pin: app_state.get('currentUser.preferences.speak_mode_pin'), action: 'edit', hide_hint: app_state.get('currentUser.preferences.hide_pin_hint')});
        } else if(app_state.get('currentUser.preferences.long_press_edit')) {
          app.toggleMode('edit');
        }
        return true;
      } else if(app_state.get('speak_mode') && app_state.get('currentUser.preferences.inflections_overlay')) {
        if(opts.button_id) {
          // TODO: scanning will require a reset, and looking for this
          // new mini-grid, but scanning can wait because how do you
          // open this overlay via scanning anyway? Idea: another button
          var grid = editManager.grid_for(opts.button_id);
          var $button = $(".button[data-id='" + opts.button_id + "']");
          if($button[0] && grid && !modal.is_open() && !modal.is_open('highlight') && !modal.is_open('highlight-secondary')) {
            editManager.overlay_grid(grid, $button[0], opts);
          }
          return true;
        } else if(opts.radial_id && opts.radial_dom) {
          // TODO: look for handler for radial, it should return
          // a hash of button labels, images and callbacks to be rendered
          // around the original element:
          // [
          //   {location: 'n', label: 'more', image: 'https://...', callback: function() { }},
          //   {...} location 's', 'c', 'e', 'nw', etc.
          // ]
        }
      } else if(app_state.get('default_mode') && opts.button_id) {
        var button = editManager.find_button(opts.button_id);
        if(button && (button.label || button.vocalization)) {
          modal.open('word-data', {word: (button.label || button.vocalization), button: button, usage_stats: null, user: app_state.get('currentUser')});
        }
        return true;
      }
    }
  },
  overlay_button_from: function(button, board) {
    return editManager.Button.create({
      overlay: true,
      board: board,
      id: button.get('id'),
      label: button.get('label'),
      image_id: button.get('image_id'),
      sound_id: button.get('sound_id'),
      part_of_speech: button.get('part_of_speech')
    });
  },
  inflection_for_types: function(history, locale) {
    if(!locale || !locale.match(/^en/) || history.length == 0) {
      return {};
    }
    // TODO: support :pre(:past-tense) lookups to apply
    // tenses when available as a pre-application
    var inflections = {};
    // Greedy algorithm stops at the first match
    var rules = [
      // Verbs:
      //   pronoun (I, you, they, we): present (c)
      {type: 'verb', lookback: [{words: ["i", "you", "they", "we", "these", "those"]}, {optional: true, type: 'adverb'}], inflection: 'present', location: 'c'},
      //   pronoun (he, she, it) [adverb (never, already, etc.)]: simple_present (n)
      {type: 'verb', lookback: [{words: ["he", "she", "it", "that", "this"]}, {optional: true, type: 'adverb'}], inflection: 'simple_present', location: 'n'},
      //   pronoun (he, she, you, etc.) [verb (is, are, were, etc.)] [not|adverb (never, probably, etc.)] verb (-ing, going): infinitive (e)
      {type: 'verb', lookback: [{type: 'pronoun'}, {words: ["is", "am", "are", "was", "were"], optional: true}, {type: 'adverb', optional: true}, {words: ["not"], optional: true}, {type: 'verb', match: /ing$/}], inflection: 'infinitive', location: 'e'},
      //   pronoun [verb (will, would, could, etc.)] verb (is, am, was) [not|adverb (never, already, etc.)]: present_participle (s)
      {type: 'verb', lookback: [], inflection: 'present_participle', location: 's'},
      //   verb (being, have, has, had) [adverb] [not]: past (w)
      {type: 'verb', lookback: [{words: ["being", "doing", "has", "have", "had"], optional: true}, {type: 'adverb', optional: true}, {words: ["not"], optional: true}], inflection: 'past', location: 'w'},
      //   verb (have, has, had) pronoun (I, you, he) [adverb] [not]: past (w)
      {type: 'verb', lookback: [{words: ["have", "has", "had"]}, {type: 'pronoun'}, {type: 'adverb', optional: true}, {words: ["not"], optional: true}], inflection: 'past', location: 'w'},
      //   verb (have, has, had) [not] been: present_participle (s)
      {type: 'verb', lookback: [{words: ["have", "has", "had"]}, {words: ["not"], optional: true}, {words: ["been"]}], inflection: 'present_participle', location: 's'},
      {type: 'verb', lookback: [{words: ["can", "could", "will", "would", "may", "might", "must", "shall", "should"]}, {words: ["not"], optional: true}, {words: ["be"]}], inflection: 'present_participle', location: 's'},
      //   verb (is, am, was, be, are, were, etc.) [pronoun (he, she, it, etc.)] [not]: present_participle (s)
      {type: 'verb', lookback: [{words: ["is", "am", "was", "were", "be", "are"]}, {type: 'pronoun', optional: true}, {type: 'adverb', optional: true}, {words: ["not"], optional: true}], inflection: 'present_participle', location: 's'},
      //   verb (do, does, did, etc.) pronoun (he, she, it, etc.) [not]: present (c)
      //   verb (do, does, did, etc.) [determiner] noun: present (c)
      //   noun (singular): simple_present (n)
      {type: 'verb', lookback: [{type: "noun", non_match: /[^s]s$/}], inflection: 'simple_present', location: 'n'},
      //   will: present (c)
      // Nouns: 
      //   plural determiners (those, these, some, many): plural (n)
      {type: 'noun', lookback: [{words: ["those", "these", "some", "many"]}], inflection: 'plural', location: 'n'},
      //   else: base (c)
      // Pronouns:
      //   (at, for, with): objective (n)
      {type: 'pronoun', lookback: [{words: ["at", "for", "with"]}], inflection: 'objective', location: 'n'},
      //   pronoun (that, it, this) verb (is, was): objective (n)
      {type: 'pronoun', lookback: [{words: ["this", "that", "it"]}, {words: ["is", "was"]}], inflection: 'objective', location: 'n'},
      {type: 'pronoun', lookback: [{words: ["these", "those"]}, {words: ["are", "were"]}], inflection: 'possesive_adjective', location: 'w'},
      //   (is, was): objective(n) or possesive_adjective (w)
    ];
    var matches = function(rule, history) {
      if(history.length == 0) { return false; }
      var history_idx = history.length - 1;
      var valid = true;
      for(var idx = rule.lookback.length - 1; idx >= 0 && valid; idx--) {
        var item = history[history_idx]
        var check = rule.lookback[idx];
        if(!item) { 
          if(!check.optional) {
            valid = false;
          }
        } else {
          var label = item.label.toLowerCase();
          var matching = false;
          if(check.words) {
            if(check.words.indexOf(label) != -1) {
              matching = true;
            }
          } else if(check.type) {
            if(item.part_of_speech == check.type) {
              matching = true;
            }
          }
          if(matching) {
            if(check.match) {
              if(!label.match(check.match)) {
                matching = false;
              }
            }
            if(check.non_match) {
              if(label.match(check.non_match)) {
                matching = false;
              }
            }  
          }
          if(matching) {
            history_idx--;
          } else if(!check.optional) {
            valid = false;
          }
        }
      }
      return valid;
    };
    if(history.length > 0) {
      rules.forEach(function(rule) {
        if(inflections[rule.type]) { return; }
        if(matches(rule, history)) {
          inflections[rule.type] = rule;
        }
      });  
      // TO BE verb overrides
      if(matches({lookback: [{words: ["i"]}]}, history)) {
        inflections["is"] = {type:'override', label: "am"};
        inflections["are"] = {type:'override', label: "am"};
        inflections["does"] = {type:'override', label: "do"};
        inflections["has"] = {type:'override', label: "have"};
        inflections["were"] = {type:'override', label: "was"};
      }
      if(matches({lookback: [{words: ["you"]}]}, history)) {
        inflections["is"] = {type:'override', label: "are"};
        inflections["am"] = {type:'override', label: "are"};
        inflections["was"] = {type:'override', label: "were"};
        inflections["does"] = {type:'override', label: "do"};
        inflections["has"] = {type:'override', label: "have"};
      }
      if(matches({lookback: [{words: ["he", "she"]}]}, history)) {
        inflections["am"] = {type:'override', label: "is"};
        inflections["were"] = {type:'override', label: "was"};
      }
      if(matches({lookback: [{words: ["it", "that", "this"]}]}, history)) {
        inflections["am"] = {type:'override', label: "is"};
        inflections["were"] = {type:'override', label: "was"};
      }
    }

    return inflections;
  },
  update_inflections: function(buttons, inflections_for_type) {
    var arr = [];
    for(var key in inflections_for_type) {
      var ref = inflections_for_type[key];
      ref.key = key;
      arr.push(ref);
    }
    var res = [];
    buttons.forEach(function(button) {
      var updated_button = Object.assign({}, button);
      // For now, skip if there are manual inflections
      if(!button.inflections && !button.vocalization && !button.load_board) {
        arr.forEach(function(infl) {
          if(infl.key == button.label && infl.type == 'override') {
            updated_button.original_label = button.original_label || button.label;
            updated_button.label = infl.label;
            updated_button.tweaked = true;
          } else if(button.part_of_speech == infl.key && infl.type != 'override') {
            var new_label = button.inflection_defaults && button.inflection_defaults[infl.location];
            if(!new_label) {
              var grid = editManager.grid_for(button) || [];
              new_label = (grid.find(function(i) { return i.location == infl.location; }) || {}).label;
            }
            if(new_label) {
              updated_button.original_label = button.original_label || button.label;
              updated_button.label = new_label;
              updated_button.tweaked = true;
            }
          }
        });
      }
      res.push(updated_button);
    });
    return res;
  },
  grid_for: function(button_id) {
    var button = button_id;
    if(!button || !button.id) {
      button = editManager.find_button(button_id);
    }
    if(!this.controller || !app_state.controller) { return; }
    var expected_inflections_version = 1;
    var board = this.controller.get('model');
    var res = [];
    if(!button) { return null; }
    var select_button = function(label, vocalization, event) {
      var overlay_button = editManager.overlay_button_from(button, board);
  
      app_state.controller.activateButton(overlay_button, {
        board: editManager.controller.get('model'),
        overlay_label: label,
        overlay_vocalization: vocalization,
        event: event,
        trigger_source: 'overlay',
        overlay_location: event.overlay_location
      });
    };
    var voc_locale = app_state.get('vocalization_locale') || navigator.language;
    var lab_locale = app_state.get('label_locale') || navigator.language;
    var base_label = button.label;
    var trans = (app_state.controller.get('board.model.translations') || {})[button_id];
    var voc = (trans || {})[voc_locale];
    var lab = (trans || {})[lab_locale];
    var locs = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];
    var list = [];
    var ignore_defaults = false;
    var defaults_allowed = true;
    // If the button has been set to a different part of speech than
    // what the defaults were expecting, don't use the defaults
    if(button.inflection_defaults && button.inflection_defaults.types && button.inflection_defaults.types[0] != button.part_of_speech) {
      ignore_defaults = true;
    }
    if(button.inflections || trans || button.inflection_defaults) {
      if(button.inflection_defaults) {
        base_label = button.inflection_defaults['base'] || button.inflection_defaults['c'] || button.inflection_defaults['src'] || button.label;
      }
      for(var idx = 0; idx < 8; idx++) {
        var for_current_locale = !voc_locale || !app_state.controller.get('model.board.locale') || (voc_locale == lab_locale && voc_locale == app_state.controller.get('model.board.locale'));
        var trans_voc = voc && (voc.inflections || [])[idx];
        if(!ignore_defaults && !trans_voc && voc) {
          trans_voc = (voc.inflection_defaults || {})[locs[idx]]; 
          if((voc.inflection_defaults || {}).v != expected_inflections_version) {
            defaults_allowed = false;
          }
        }
        var trans_lab = lab && (lab.inflections || [])[idx];
        if(!ignore_defaults && !trans_lab && lab) { 
          trans_lab = (lab.inflection_defaults || {})[locs[idx]];
          if((voc.inflection_defaults || {}).v != expected_inflections_version) {
            defaults_allowed = false;
          }
        }
        // If it's for the current locale we can just use the inflections
        // list or suggested defaults, otherwise we need to check the
        // translations for inflections/suggested defaults
        if(for_current_locale && button.inflections && button.inflections[idx]) {
          defaults_allowed = false;
          list.push({location: locs[idx], label: button.inflections[idx]});
        } else if(for_current_locale && button.inflection_defaults && button.inflection_defaults[locs[idx]]) {
          if(button.inflection_defaults.v != expected_inflections_version) {
            defaults_allowed = false;
          }
          if(locs[idx] == 'se' && !button.inflection_defaults.no) {
            list.push({location: locs[idx], label: button.inflection_defaults[locs[idx]], opposite: true});
          } else {
            list.push({location: locs[idx], label: button.inflection_defaults[locs[idx]]});
          }
        } else if(trans_voc && trans_lab) {
          list.push({location: locs[idx], label: trans_lab, voc: trans_voc});
        }
      }
      if(list.length > 0) { 
        list.push({location: 'c', label: (lab || {}).label || button.label, vocalization: (voc || {}).label || button.vocalization});
        res = list; 
      }
    }
    // Only use the fallacks if it's a known locale for label and vocalization,
    // and there are no existing values populated or the default values were used,
    // i.e. don't use fallbacks if the user manually set any inflections
    if(lab_locale.match(/^en/i) && lab_locale == voc_locale && (res.length == 0 || defaults_allowed)) {
      var inflection_types = (button.inflection_defaults || {}).types || [];
      if(button.part_of_speech == 'noun') {
        // next to close need a "more" option that
        // can be replaced by up/down
        res = res.concat([
          {location: 'n', label: i18n.pluralize(base_label)},
          {location: 'c', label: button.label},
          {location: 's', label: i18n.possessive(base_label)},
        ]);
        if(inflection_types.indexOf('verb') != -1) {
          res = res.concat([
            {location: 'w', label: i18n.tense(base_label, {simple_past: true})},
            {location: 's', label: i18n.tense(base_label, {present_participle: true})},
            {location: 'sw', label: i18n.tense(base_label, {past_participle: true})},
            {location: 'n', label: i18n.tense(base_label, {simple_present: true})},
            {location: 'e', label: i18n.tense(base_label, {infinitive: true})},  
            {location: 'nw', label: i18n.tense(base_label, {simple_past: true})}, // dup
            {location: 'ne', label: base_label}, // dup
          ]);
        }
        if(inflection_types.indexOf('adjective') != -1) {
          res = res.concat([
            {location: 'ne', label: i18n.comparative(base_label)},
            {location: 'e', label: i18n.superlative(base_label)},
            {location: 'w', label: i18n.negative_comparative(base_label)},
          ]);
        }
        res = res.concat([
          {location: 'nw', label: i18n.negation(base_label)},
        ]);
      } else if(button.part_of_speech == 'adjective') {
        res = res.concat([
//          {location: 'n', label: i18n.pluralize(button.label)},
          {location: 'ne', label: i18n.comparative(base_label)},
          {location: 'e', label: i18n.superlative(base_label)},
          {location: 'nw', label: i18n.negation(base_label)},
          {location: 'w', label: i18n.negative_comparative(base_label)},
          {location: 'c', label: button.label},
        ]);
        if(inflection_types.indexOf('noun') != -1) {
          res = res.concat([
            {location: 'n', label: i18n.pluralize(base_label)},
            {location: 's', label: i18n.possessive(base_label)},
          ]);
        }
        if(inflection_types.indexOf('verb') != -1) {
          res = res.concat([
            {location: 'w', label: i18n.tense(base_label, {simple_past: true})},
            {location: 's', label: i18n.tense(base_label, {present_participle: true})},
            {location: 'sw', label: i18n.tense(base_label, {past_participle: true})},
            {location: 'n', label: i18n.tense(base_label, {simple_present: true})},
            {location: 'e', label: i18n.tense(base_label, {infinitive: true})},  
            {location: 'nw', label: i18n.tense(base_label, {simple_past: true})}, // dup
            {location: 'ne', label: base_label}, // dup
          ]);
        }
      } else if(button.part_of_speech == 'pronoun') {
        res = res.concat([
          {location: 'c', label: button.label},
          {location: 's', label: i18n.possessive(base_label, {pronoun: true})},
          {location: 'n', label: i18n.possessive(base_label, {objective: true})},
          {location: 'w', label: i18n.possessive(base_label, {})},
          {location: 'e', label: i18n.possessive(base_label, {reflexive: true})}
        ]);
      } else if(button.part_of_speech == 'verb') {
        res = res.concat([
          {location: 'w', label: i18n.tense(base_label, {simple_past: true})},
          {location: 's', label: i18n.tense(base_label, {present_participle: true})},
          {location: 'sw', label: i18n.tense(base_label, {past_participle: true})},
          {location: 'n', label: i18n.tense(base_label, {simple_present: true})},
          {location: 'e', label: i18n.tense(base_label, {infinitive: true})},
          // {location: 'sw', label: i18n.perfect_non_progression(button.label)},
          {location: 'c', label: button.label}
        ]);
        if(inflection_types.indexOf('noun') != -1) {
          res = res.concat([
            {location: 'n', label: i18n.pluralize(base_label)},
            {location: 's', label: i18n.possessive(base_label)},  
          ]);
        }
        if(inflection_types.indexOf('adjective') != -1) {
          res = res.concat([
            {location: 'ne', label: i18n.comparative(base_label)},
            {location: 'e', label: i18n.superlative(base_label)},
            {location: 'w', label: i18n.negative_comparative(base_label)},
          ]);
        }
        res = res.concat([
          {location: 'nw', label: i18n.tense(base_label, {simple_past: true})}, // dup
          {location: 'ne', label: base_label}, // dup
        ]);
      } else {
        console.log("unrecognized en button type", button.part_of_speech, button);
        if(button.part_of_speech == 'numeral' || (button.label || '').match(/^[0-9\.\,]+$/)) {
          res = res.concat([
            {location: 'n', label: i18n.ordinal(button.label)}
          ]);
        }
        res = res.concat([
  //        {location: 'n', label: 'ice cream', callback: function() { alert('a'); }},
          {location: 'c', label: button.label},
          {location: 'se', label: i18n.negation(base_label)},
  //        {location: 'se', label: 'bacon', callback: function() { alert('c'); }},
        ]);
      }
    }
    var final = [];
    var seen_locations = {};
    res.forEach(function(i) { 
      if(!seen_locations[i.location]) {
        final.push(i);
      }
      seen_locations[i.location] = true;
    })
    final.select = function(obj, event) {
      event.overlay_location = obj.location;
      select_button(obj.label, obj.vocalization, event);
    };
    if(final.length == 0) { return null; }
    return final;
  },
  overlay_grid: function(grid, elem, event) {
    // TODO: log the overlay being opened somewhere

    // if we have room put the close/cancel button underneath,
    // otherwise put it on top or on the right
    var bounds = elem.getBoundingClientRect();
    var screen_width = window.innerWidth;
    var screen_height = window.innerHeight;
    var header_height = $("header").height();
    if(bounds.width > 0 && bounds.height > 0) {
      var margin = 5; // TODO: this is a user pref
      var button_width = bounds.width + (margin * 2);
      var button_height = bounds.height + (margin * 2);
      var top = bounds.top;
      var left = bounds.left;
      var vertical_close = true;
      var resize_images = false;
      if(button_height > (screen_height - header_height) / 3) {
        // grid won't fit, needs to shrink
        if(screen_height < screen_width) {
          vertical_close = false;
        }
        resize_images = true;
        button_height = (screen_height - header_height - margin - margin) / (vertical_close ? 3.5 : 3);
        top = event.clientY - (button_height / 2);
      }
      if(button_width > screen_width / 3) {
        // grid won't fit, needs to shrink
        button_width = screen_width / (vertical_close ? 3 : 3.5);
        left = event.clientX - (button_width / 2);
      }
      var left = Math.max(left - margin, button_width);
      var left = Math.min(left, screen_width - button_width - button_width);
      // don't let it go above the fold
      var top = Math.max(top - margin, button_height);
      // don't let it go below the screen edge
      var top = Math.min(top, screen_height - button_height - button_height);
      // keep it below the header
      top = Math.max(top, header_height + margin + button_height);
      // shift up just a little if it's not on the bottom, but will get clipped
      if(vertical_close) {
        if((top + button_height) < screen_height - (button_height * 1.5)) {
          top = Math.min(top, screen_height - button_height * 3);
        }
      }
      var layout = [];
      var hash = {'nw': 0, 'n': 1, 'ne': 2, 'w': 3, 'c': 4, 'e': 5, 'sw': 6, 's': 7, 'se': 8};
      grid.forEach(function(e) {
        if(hash[e.location] != null && !layout[hash[e.location]]) {
          layout[hash[e.location]] = e;
        }
      });
      var far_left = left - button_width;
      var far_right = left + button_width + button_width;
      var far_top = top - button_height;
      var far_bottom = top + button_height + button_height;
      // TODO: if the buttons are small enough, allow for a full-size (not half-size) close button
      var too_tall = button_height > (screen_height / 4);
      var too_wide = button_width > (screen_width / 4);
      var close_position = 'n';
      if(vertical_close) {
        if((top + button_height) < screen_height - (button_height * 1.5)) {
          close_position = 's';
          far_bottom = far_bottom + (button_height * (too_tall ? 0.5 : 1.0));
          // put the close underneath
        } else {
          far_top = far_top - (button_height * (too_tall ? 0.5 : 1.0));
          // put the close above
        }
      } else {
        if((left + button_width) < screen_width - (button_width * 1.5)) {
          close_position = 'e';
          far_right = far_right + (button_width * (too_wide ? 0.5 : 1.0));
          // put the close to the right
        } else {
          close_position = 'w';
          far_left = far_left - (button_width * (too_wide ? 0.5 : 1.0));
          // put the close to the left
        }
      }
      var pad = 5;
      var div = document.createElement('div');
      div.id = 'overlay_container';
      div.setAttribute('class', document.getElementsByClassName('board')[0].getAttribute('class'));
      div.classList.add('overlay');
      div.classList.add('board');
      div.style.left = (far_left - pad) + 'px';
      div.style.width = (far_right - far_left + (pad * 2)) + 'px';
      div.style.top = (far_top - pad) + 'px';
      div.style.height = (far_bottom - far_top + (pad * 2)) + 'px';
      div.style.padding = pad + 'px';
      var button_margin = 5; // TODO: this is a user preference
      var img = elem.getElementsByClassName('symbol')[0];
      var lbl = elem.getElementsByClassName('button-label-holder')[0];
      var inner = lbl.getElementsByClassName('button-label')[0];
      inner.style.display = 'inline';
      var lbl_height = Math.max(lbl.getBoundingClientRect().height);
      inner.style.display = '';
      var text_position = 'top';
      if(app_state.get('referenced_user.preferences.device.button_text_position') == 'bottom') {
        text_position = 'bottom';
      } else if(app_state.get('referenced_user.preferences.device.button_text_position') == 'text_only') {
        text_position = 'no_image';
      } else if(app_state.get('referenced_user.preferences.device.button_text_position') == 'none') {
        text_position = 'bottom';
      }
      var formatted_button = function(label, image_url, opposite) {
        // TODO: this needs to call persistence.find_url for local versions
        image_url = image_url || (img || {}).src || "https://opensymbols.s3.amazonaws.com/libraries/mulberry/paper.svg";
        var btn = document.createElement('div');
        btn.setAttribute('class', elem.getAttribute('class').replace(/b_[\w\d_]+_/, ''));
        btn.classList.add('overlay_button');
        if(opposite) {
          btn.classList.add('opposite');
        }
        btn.classList.add('b__');
        btn.classList.remove('touched');
        btn.style.margin = button_margin + 'px';
        btn.style.width = Math.floor(button_width - (button_margin * 2)) + 'px';
        btn.style.height = Math.floor(button_height - (button_margin * 2)) + 'px';
        var html = "";
        if(text_position != 'no_image' && img && img.parentNode) {
          html = html + "<span class='img_holder' style=\"" + img.parentNode.getAttribute('style') + "\"><img src=\"" + image_url + "\" style=\"width: 100%; vertical-align: middle; height: 100%; object-fit: contain; object-position: center;\"/></span>";
        } else {
          html = html + "<span class='img_holder'></span>";
        }
        html = html + "<div class='button-label-holder " + text_position + "'><span class='button-label' style='display: inline;'>" + label + "</span></div>";
        btn.innerHTML = html
        var holder = btn.getElementsByClassName('img_holder')[0];
        holder.style.display = 'inline-block';
        holder.style.height = (button_height - lbl_height - margin - margin) + 'px';
        holder.style.lineHeight = holder.style.height;
        if(img) {
          holder.getElementsByTagName('IMG')[0].style.height = holder.style.height;
        }
        return btn;
      };
      var close_row = document.createElement('div');
      close_row.classList.add('overlay_row');
      close_row.classList.add('button_row');
      var close = formatted_button('close', "https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/274c.svg");
      if(close_position != 'w') {
        close.style.float = 'right';
      }
      close.select_callback = function() {
        div.parentNode.removeChild(div);
        // TODO: log the close event somewhere
      };
      close_row.appendChild(close);
      if(close_position == 'n') {
        div.appendChild(close_row);
      }
      var row = null;
      for(var idx = 0; idx < 9; idx++) {
        if(idx % 3 == 0) {
          row = document.createElement('div');
          row.classList.add('overlay_row');
          row.classList.add('button_row');
          if(close_position == 'w') {
            if(idx == 0) {
              row.appendChild(close);
            } else {
              var btn = formatted_button('nothing');
              btn.style.visibility = 'hidden';
              row.appendChild(btn);
            }
          }
        }
        var btn = formatted_button((layout[idx] || {}).label || "nothing", null, (layout[idx] || {}).opposite);
        if(idx == 4) { 
          btn.setAttribute('class', elem.getAttribute('class')); 
          btn.classList.remove('touched');
          btn.classList.add('overlay_button');
        }
        btn.select_callback = (function(obj) {
          return function(event) {
            // TODO: log the event somewhere
            if(obj && obj.callback) {
              obj.callback(event);
            } else if(grid.select) {
              grid.select(obj, event);
            }
            runLater(function() {
              div.parentNode.removeChild(div);
            }, 50);
          }
        })(layout[idx]);
        if(!layout[idx]) {
          btn.style.visibility = 'hidden';
        }
        row.appendChild(btn);
        if(idx % 3 == 2) {
          if(close_position == 'e') {
            if(idx == 8) {
              row.appendChild(close);
            } else {
              var btn = formatted_button();
              document.createElement('div');
              btn.style.visibility = 'hidden';
              row.appendChild(btn);
            }
          }
          div.appendChild(row);
        }
      }
      if(close_position == 's') {
        div.appendChild(close_row);
      }

      document.body.appendChild(div);
    }

    // TODO: for the log event mark it as an overlay event,
    // for computing travel don't +1 depth or anything,
    // but track how many times each button has overlays used
    // so we can learn which are the most useful
  },
  auto_edit: function(id) {
    // used to auto-enter edit mode after creating a brand new board
    this.auto_edit.edits = (this.auto_edit.edits || {});
    this.auto_edit.edits[id] = true;
  },
  clear_history: function() {
    this.setProperties({
      'history': [],
      'future': []
    });
    this.lastChange = {};
    this.bogus_id_counter = 0;
    if(this.controller && this.controller.get('ordered_buttons')) {
      var neg_ids = [0];
      this.controller.get('ordered_buttons').forEach(function(row) {
        row.forEach(function(btn) {
          var num_id = parseInt(btn.get('id'), 10) || 0;
          if(num_id < 0 && isFinite(num_id)) {
            neg_ids.push(num_id);
          }
        });
      });
      this.bogus_id_counter = (Math.min.apply(null, neg_ids) || -999);
    }
  },
  update_history: observer('history', 'history.[]', 'future', 'future.[]', function() {
    if(this.controller) {
      this.controller.set('noRedo', this.get('future').length === 0);
      this.controller.set('noUndo', this.get('history').length === 0);
    }
  }),
  // TODO: should we be using this to ensure modifying proper board?
//   forBoard: function(board, callback) {
//     if(this.controller.get('model.id') == board.get('id')) {
//       callback();
//     }
//   },
  clear_text_edit: function() {
    this.lastChange = {};
  },
  save_state: function(details) {
    // TODO: needs revisit
    // currently if you reset state to exactly what it was before it'll still add to undo history. this is dumb.
    // also if I change the label, then change the color on the same button, only counts as one undo event. is that dumb? unsure.
    this.set('future', []);
    if(details && this.lastChange && details.button_id == this.lastChange.button_id && details.changes && JSON.stringify(details.changes) == JSON.stringify(this.lastChange.changes)) {
      // don't add to state if it's the same as the previous edit (i.e. add'l change to label)
    } else if(details && this.lastChange && details.mode == 'paint' && details.paint_id == this.lastChange.paint_id) {
      // don't add to state if it's the same paint as the previous edit.
    } else {
      this.get('history').pushObject(this.clone_state());
    }
    this.lastChange = details;
  },
  clone_state: function() {
    if(!this.controller) { return; }
    var oldState = this.controller.get('ordered_buttons');
    var board = this.controller.get('model');
    var clone_state = [];
    for(var idx = 0; idx < oldState.length; idx++) {
      var arr = [];
      for(var jdx = 0; jdx < oldState[idx].length; jdx++) {
        var raw = oldState[idx][jdx].raw();
        raw.local_image_url = oldState[idx][jdx].get('local_image_url');
        raw.local_sound_url = oldState[idx][jdx].get('local_sound_url');
        var b = editManager.Button.create(raw, {board: board, pending: false});
        if(b.get('board') != board || b.get('pending') != false) { alert('blech!'); }
        b.set('id', oldState[idx][jdx].get('id'));
        arr.push(b);
      }
      clone_state.push(arr);
    }
    return clone_state;
  },
  undo: function() {
    if(!this.controller) { return; }
    var lastState = this.get('history').popObject();
    if(lastState) {
      var currentState = this.clone_state();
      this.get('future').pushObject(currentState);
      this.controller.set('ordered_buttons', lastState);
    }
  },
  redo: function() {
    if(!this.controller) { return; }
    var state = this.get('future').popObject();
    if(state) {
      var currentState = this.clone_state();
      this.get('history').pushObject(currentState);
      this.controller.set('ordered_buttons', state);
    }
  },
  bogus_id_counter: 0,
  fake_button: function() {
    var button = editManager.Button.create({
      empty: true,
      label: '',
      id: --this.bogus_id_counter
    });
    var controller = this.controller;
    var board = controller.get('model');
    button.set('board', board);
    return button;
  },
  modify_size: function(type, action, index) {
    this.save_state({
    });
    var state = this.controller.get('ordered_buttons');
    var newState = [];
    var fakeRow = [];
    if(type == 'column') {
      if(index == null) {
        index = (action == 'add' ? state[0].length : state[0].length - 1);
      }
    } else {
      if(index == null) {
        index = (action == 'add' ? state.length : state.length - 1);
      }
      for(var idx = 0; idx < state[0].length; idx++) {
        fakeRow.push(this.fake_button());
      }
    }
    for(var idx = 0; idx < state.length; idx++) {
      var row = [];
      if(index == idx && action == 'add' && type == 'row') {
        newState.push(fakeRow);
      }
      if(index == idx && action == 'remove' && type == 'row') {
      } else {
        for(var jdx = 0; jdx < state[idx].length; jdx++) {
          if(jdx == index && action == 'add' && type == 'column') {
            row.push(this.fake_button());
          }
          if(jdx == index && action == 'remove' && type == 'column') {
          } else {
            row.push(state[idx][jdx]);
          }
        }
        if(index == state[0].length && action == 'add' && type == 'column') {
          row.push(this.fake_button());
        }
        if(row.length === 0) { row.push(this.fake_button()); }
        newState.push(row);
      }
    }
    if(index == state.length && action == 'add' && type == 'row') {
      newState.push(fakeRow);
    }
    if(newState.length === 0) { newState.push(fakeRow); }
    this.controller.set('ordered_buttons', newState);
  },
  find_button: function(id) {
    if(!this.controller || !this.controller.get) { return []; }
    var ob = this.controller.get('ordered_buttons') || [];
    var res = null;
    for(var idx = 0; idx < ob.length; idx++) {
      for(var jdx = 0; jdx < ob[idx].length; jdx++) {
        if(!res) {
          if(id && ob[idx][jdx].id == id) {
            res = ob[idx][jdx];
          } else if(id == 'empty' && ob[idx][jdx].empty) {
            res = ob[idx][jdx];
          }
        }
      }
    }
    var board = this.controller.get('model');
    var buttons = board.contextualized_buttons(app_state.get('label_locale'), app_state.get('vocalization_locale'), stashes.get('working_vocalization'), false);
    if(res) {
      var trans_button = buttons.find(function(b) { return b.id == id; });
      if(trans_button && !emberGet(res, 'user_modified')) {
        res.set('label', trans_button.label);
        res.set('vocalization', trans_button.vocalization);
      }
      return res;
    }
    if(board.get('fast_html')) {
      buttons.forEach(function(b) {
        if(id && id == b.id) {
          res = editManager.Button.create(b, {board: board});
        }
      });
    }
    return res;
  },
  clear_button: function(id) {
    var opts = {};
    for(var idx = 0; idx < editManager.Button.attributes.length; idx++) {
      opts[editManager.Button.attributes[idx]] = null;
    }
    opts.label = '';
    opts.image = null;
    opts.local_image_url = null;
    opts.local_sound_url = null;
    opts.image_style = null;
    this.change_button(id, opts);
  },
  change_button: function(id, options) {
    this.save_state({
      button_id: id,
      changes: Object.keys(options)
    });
    var button = this.find_button(id);
    if(button) {
      if(options.image) {
        emberSet(button, 'local_image_url', null);
        button.load_image();
      } else if(options.image === null) {
        emberSet(button, 'local_image_url', null);
      }
      if(options.sound) {
        emberSet(button, 'local_sound_url', null);
        button.load_sound();
      }
      for(var key in options) {
        emberSet(button, key, options[key]);
      }
      emberSet(button, 'user_modified', true);
      this.check_button(id);
    } else {
      console.log("no button found for: " + id);
    }
  },
  check_button: function(id) {
    var button = this.find_button(id);
    var empty = !button.label && !button.image_id;
    emberSet(button, 'empty', !!empty);
  },
  stash_button: function(id) {
    var list = stashes.get_object('stashed_buttons', true) || [];
    var button = null;
    if(id && id.raw) {
      button = id.raw();
    } else {
      button = this.find_button(id);
      button = button && button.raw();
    }
    if(button) {
      delete button.id;
      button.stashed_at = (new Date()).getTime();
    }
    if(button && list[list.length - 1] != button) {
      list.pushObject(button);
    }
    stashes.persist('stashed_buttons', list);
  },
  get_ready_to_apply_stashed_button: function(button) {
    if(!button || !button.raw) {
      console.error("raw buttons won't work");
    } else if(button) {
      this.stashedButtonToApply = button.raw();
      this.controller.set('model.finding_target', true);
    }
  },
  apply_stashed_button: function(id) {
    if(this.stashedButtonToApply) {
      this.change_button(id, this.stashedButtonToApply);
      this.stashedButtonToApply = null;
    }
  },
  finding_target: function() {
    return this.swapId || this.stashedButtonToApply;
  },
  apply_to_target: function(id) {
    if(this.swapId) {
      this.switch_buttons(id, this.swapId);
    } else if(this.stashedButtonToApply) {
      this.apply_stashed_button(id);
    }
    this.controller.set('model.finding_target', false);
  },
  prep_for_swap: function(id) {
    var button = this.find_button(id);
    if(button) {
      button.set('for_swap', true);
      this.swapId = id;
      this.controller.set('model.finding_target', true);
    }
  },
  switch_buttons: function(a, b, decision) {
    if(a == b) { return; }
    this.save_state();
    var buttona = this.find_button(a);
    var buttonb = this.find_button(b);
    if(!buttona || !buttonb) { console.log("couldn't find a button!"); return; }
    if(buttonb.get('folderAction') && !decision) {
      buttona = buttona && editManager.Button.create(buttona.raw());
      buttona.set('id', a);
      buttonb = buttonb && editManager.Button.create(buttonb.raw());
      buttonb.set('id', b);
      modal.open('swap-or-drop-button', {button: buttona, folder: buttonb});
      return;
    }
    var ob = this.controller.get('ordered_buttons');
    for(var idx = 0; idx < ob.length; idx++) {
      for(var jdx = 0; jdx < ob[idx].length; jdx++) {
        if(ob[idx][jdx].id == a) {
          ob[idx][jdx] = buttonb;
        } else if(ob[idx][jdx].id == b) {
          ob[idx][jdx] = buttona;
        }
      }
    }
    buttona.set('for_swap', false);
    buttonb.set('for_swap', false);
    this.swapId = null;
    this.controller.set('ordered_buttons', ob);
    this.controller.redraw_if_needed();
  },
  move_button: function(a, b, decision) {
    var button = this.find_button(a);
    var folder = this.find_button(b);
    if(button) {
      button = editManager.Button.create(button.raw());
    }
    if(!button || !folder) { return RSVP.reject({error: "couldn't find a button"}); }
    if(!folder.load_board || !folder.load_board.key) { return RSVP.reject({error: "not a folder!"}); }
    this.clear_button(a);

    var find = CoughDrop.store.findRecord('board', folder.load_board.key).then(function(ref) {
      return ref;
    });
    var reload = find.then(function(ref) {
      return ref.reload();
    });
    var _this = this;
    var ready_for_update = reload.then(function(ref) {
      if(ref.get('permissions.edit')) {
        return RSVP.resolve(ref);
      } else if(ref.get('permissions.view')) {
        if(decision == 'copy') {
          return ref.create_copy().then(function(copy) {
            _this.change_button(b, {
              load_board: {id: copy.get('id'), key: copy.get('key')}
            });
            return copy;
          });
        } else {
          return RSVP.reject({error: 'view only'});
        }
      } else {
        return RSVP.reject({error: 'not authorized'});
      }
    });

    var new_id;
    var update_buttons = ready_for_update.then(function(board) {
      new_id = board.add_button(button);
      return board.save();
    });

    return update_buttons.then(function(board) {
      return RSVP.resolve({visible: board.button_visible(new_id), button: button});
    });
  },
  paint_mode: null,
  set_paint_mode: function(fill_color, border_color, part_of_speech) {
    if(fill_color == 'hide') {
      this.paint_mode = {
        hidden: true,
        paint_id: Math.random()
      };
    } else if(fill_color == 'show') {
      this.paint_mode = {
        hidden: false,
        paint_id: Math.random()
      };
    } else if(fill_color == 'close') {
      this.paint_mode = {
        close_link: true,
        paint_id: Math.random()
      };
    } else if(fill_color == 'open') {
      this.paint_mode = {
        close_link: false,
        paint_id: Math.random()
      };
    } else if(fill_color == 'level') {
      this.paint_mode = {
        level: border_color,
        attribute: part_of_speech,
        paint_id: Math.random()
      };
    } else {
      var fill = window.tinycolor(fill_color);
      var border = null;
      if(border_color) {
        border = window.tinycolor(border_color);
      } else {
        border = window.tinycolor(fill.toRgb()).darken(30);
        if(fill.toName() == 'white') {
          border = window.tinycolor('#eee');
        } else if(fill.toHsl().l < 0.5) {
          border = window.tinycolor(fill.toRgb()).lighten(30);
        }
      }
      this.paint_mode = {
        border: border.toRgbString(),
        fill: fill.toRgbString(),
        paint_id: Math.random(),
        part_of_speech: part_of_speech
      };
    }
    this.controller.set('paint_mode', this.paint_mode);
  },
  clear_paint_mode: function() {
    this.paint_mode = null;
    if(this.controller) {
      this.controller.set('paint_mode', false);
    }
  },
  preview_levels: function() {
    if(this.controller) {
      this.controller.set('preview_levels_mode', true);
    }
  },
  clear_preview_levels: function() {
    if(this.controller) {
      this.controller.set('preview_levels_mode', false);
      this.controller.set('preview_level', null);
      this.apply_preview_level(10);
    }
  },
  apply_preview_level: function(level) {
    if(this.controller) {
      (this.controller.get('ordered_buttons') || []).forEach(function(row) {
        row.forEach(function(button) {
          button.apply_level(level);
        });
      });
    }
  },
  release_stroke: function() {
    if(this.paint_mode) {
      this.paint_mode.paint_id = Math.random();
    }
  },
  paint_button: function(id) {
    this.save_state({
      mode: 'paint',
      paint_id: this.paint_mode.paint_id,
      button_id: id
    });
    var button = this.find_button(id);
    if(this.paint_mode.border) {
      Button.set_attribute(button, 'border_color', this.paint_mode.border);
    }
    if(this.paint_mode.fill) {
      Button.set_attribute(button, 'background_color', this.paint_mode.fill);
    }
    if(this.paint_mode.hidden != null) {
      Button.set_attribute(button, 'hidden', this.paint_mode.hidden);
    }
    if(this.paint_mode.close_link != null) {
      Button.set_attribute(button, 'link_disabled', this.paint_mode.close_link);
    }
    if(this.paint_mode.level) {
      var mods = $.extend({}, emberGet(button, 'level_modifications') || {});
      var level = this.paint_mode.attribute.toString();
      if(!mods.pre) { mods.pre = {}; }
      if(this.paint_mode.level == 'hidden' && this.paint_mode.attribute) {
        mods.pre.hidden = true;
        for(var idx in mods) {
          if(parseInt(idx, 10) > 0) { delete mods[idx]['hidden']; }
          if(Object.keys(mods[idx]).length == 0) { delete mods[idx]; }
        }
        mods[level] = mods[level] || {};
        mods[level].hidden = false;
        Button.set_attribute(button, 'level_modifications', mods);
//        emberSet(button, 'level_modifications', mods);
        // TODO: controller/boards/index#button_levels wasn't picking up this
        // change automatically, had to add explicit notification, not sure why
        editManager.controller.set('levels_change', true);
      } else if(this.paint_mode.level == 'link_disabled' && this.paint_mode.attribute) {
        mods.pre.link_disabled = true;
        for(var idx in mods) {
          if(parseInt(idx, 10) > 0) { delete mods[idx]['link_disabled']; }
          if(Object.keys(mods[idx]).length == 0) { delete mods[idx]; }
        }
        mods[level] = mods[level] || {};
        mods[level].link_disabled = false;
        emberSet(button, 'level_modifications', mods);
      } else if(this.paint_mode.level == 'clear') {
        emberSet(button, 'level_modifications', null);
      }
    }
    if(this.paint_mode.part_of_speech) {
      if(!emberGet(button, 'part_of_speech') || emberGet(button, 'part_of_speech') == emberGet(button, 'suggested_part_of_speech')) {
        emberSet(button, 'part_of_speech', this.paint_mode.part_of_speech);
        emberSet(button, 'painted_part_of_speech', this.paint_mode.part_of_speech);
      }
    }
    this.check_button(id);
  },
  process_for_displaying: function(ignore_fast_html) {
    CoughDrop.log.track('processing for displaying');
    var controller = this.controller;
    var board = controller.get('model');
    var board_level = controller.get('current_level') || stashes.get('board_level') || 10;
    board.set('display_level', board_level);
    var buttons = board.contextualized_buttons(app_state.get('label_locale'), app_state.get('vocalization_locale'), stashes.get('working_vocalization'), false);
    var grid = board.get('grid');
    if(!grid) { return; }
    var allButtonsReady = true;
    var _this = this;
    var result = [];
    var pending_buttons = [];
    var used_button_ids = {};

    CoughDrop.log.track('process word suggestions');
    if(controller.get('model.word_suggestions')) {
      controller.set('suggestions', {loading: true});
      word_suggestions.load().then(function() {
        controller.set('suggestions', {ready: true});
        controller.updateSuggestions();
      }, function() {
        controller.set('suggestions', {error: true});
      });
    }

    // new workflow:
    // - get all the associated image and sound ids
    // - if the board was loaded remotely, they should all be peekable
    // - if they're not peekable, do a batch lookup in the local db
    //   NOTE: I don't think it should be necessary to push them into the
    //   ember-data cache, but maybe do that as a background job or something?
    // - if any *still* aren't reachable, mark them as broken
    // - do NOT make remote requests for the individual records???

    var resume_scanning = function() {
      resume_scanning.attempts = (resume_scanning.attempts || 0) + 1;
      if($(".board[data-id='" + board.get('id') + "']").length > 0) {
        runLater(function() {
          if(app_state.controller) {
            app_state.controller.highlight_button('resume');
          }
        });
        if(app_state.controller) {
          app_state.controller.send('check_scanning');
        }
        // also check for word suggestions
        app_state.refresh_suggestions();
      } else if(resume_scanning.attempts < 10) {
        runLater(resume_scanning, resume_scanning.attempts * 100);
      } else {
        console.error("scanning resume timed out");
      }
    };

    var need_everything_local = app_state.get('speak_mode') || !persistence.get('online');
    if(app_state.get('speak_mode')) {
      controller.update_button_symbol_class();
      if(!ignore_fast_html && board.get('fast_html') && board.get('fast_html.width') == controller.get('width') && board.get('fast_html.height') == controller.get('height') && board.get('current_revision') == board.get('fast_html.revision') && board.get('fast_html.label_locale') == app_state.get('label_locale') && board.get('fast_html.display_level') == board_level) {
        CoughDrop.log.track('already have fast render');
        resume_scanning();
        return;
      } else {
        board.set('fast_html', null);
        board.add_classes();
        CoughDrop.log.track('trying fast render');
        var fast = board.render_fast_html({
          label_locale: app_state.get('label_locale'),
          height: controller.get('height'),
          width: controller.get('width'),
          extra_pad: controller.get('extra_pad'),
          inner_pad: controller.get('inner_pad'),
          display_level: board_level,
          base_text_height: controller.get('base_text_height'),
          text_only_button_symbol_class: controller.get('text_only_button_symbol_class'),
          button_symbol_class: controller.get('button_symbol_class')
        });

        if(fast && fast.html) {
          board.set('fast_html', fast);
          resume_scanning();
          return;
        }
      }
    }

    // build the ordered grid
    // TODO: work without ordered grid (i.e. scene displays)
    CoughDrop.log.track('finding content locally');
    var prefetch = board.find_content_locally().then(null, function(err) {
      return RSVP.resolve();
    });


    var image_urls = board.get('image_urls');
    var sound_urls = board.get('sound_urls');
    prefetch.then(function() {
      CoughDrop.log.track('creating buttons');
      for(var idx = 0; idx < grid.rows; idx++) {
        var row = [];
        for(var jdx = 0; jdx < grid.columns; jdx++) {
          var button = null;
          var id = (grid.order[idx] || [])[jdx];
          for(var kdx = 0; kdx < buttons.length; kdx++) {
            if(id !== null && id !== undefined && buttons[kdx].id == id && !used_button_ids[id]) {
              // only allow each button id to be used once, even if referenced more than once in the grid
              // TODO: if a button is references more than once in the grid, probably clone
              // it for the second reference or something rather than just ignoring it. Multiply-referenced
              // buttons do weird things when in edit mode.
              used_button_ids[id] = true;
              var more_args = {board: board};
              if(board.get('no_lookups')) {
                more_args.no_lookups = true;
              }
              if(image_urls) {
                more_args.image_url = image_urls[buttons[kdx]['image_id']];
              }
              if(sound_urls) {
                more_args.sound_url = sound_urls[buttons[kdx]['sound_id']];
              }
              button = editManager.Button.create(buttons[kdx], more_args);
            }
          }
          button = button || _this.fake_button();
          if(!button.everything_local() && need_everything_local) {
            allButtonsReady = false;
            pending_buttons.push(button);
          }
          row.push(button);
        }
        result.push(row);
      }
      if(!allButtonsReady) {
        CoughDrop.log.track('need to wait for buttons');
        board.set('pending_buttons', pending_buttons);
        board.addObserver('all_ready', function() {
          if(!controller.get('ordered_buttons')) {
            board.set('pending_buttons', null);
            controller.set('ordered_buttons',result);
            CoughDrop.log.track('redrawing if needed');
            controller.redraw_if_needed();
            CoughDrop.log.track('done redrawing if needed');
            resume_scanning();
          }
        });
        controller.set('ordered_buttons', null);
      } else {
        CoughDrop.log.track('buttons did not need waiting');
        controller.set('ordered_buttons', result);
        CoughDrop.log.track('redrawing if needed');
        controller.redraw_if_needed();
        CoughDrop.log.track('done redrawing if needed');
        resume_scanning();
        for(var idx = 0; idx < result.length; idx++) {
          for(var jdx = 0; jdx < result[idx].length; jdx++) {
            var button = result[idx][jdx];
            if(button.get('suggest_symbol')) {
              _this.lucky_symbol(button.id);
            }
          }
        }
      }
    }, function(err) {
      console.log(err);
    });
  },
  process_for_saving: function() {
    var orderedButtons = this.controller.get('ordered_buttons');
    var priorButtons = this.controller.get('model.buttons');
    var gridOrder = [];
    var newButtons = [];
    var maxId = 0;
    for(var idx = 0; idx < priorButtons.length; idx++) {
      maxId = Math.max(maxId, parseInt(priorButtons[idx].id, 10) || 0);
    }

    for(var idx = 0; idx < orderedButtons.length; idx++) {
      var row = orderedButtons[idx];
      var gridRow = [];
      for(var jdx = 0; jdx < row.length; jdx++) {
        var currentButton = row[jdx];
        var originalButton = null;
        for(var kdx = 0; kdx < priorButtons.length; kdx++) {
          if(priorButtons[kdx].id == currentButton.id) {
            originalButton = priorButtons[kdx];
          }
        }
        var newButton = $.extend({}, originalButton);
        if(currentButton.label || currentButton.image_id) {
          newButton.label = currentButton.label;
          if(currentButton.vocalization && currentButton.vocalization != newButton.label) {
            newButton.vocalization = currentButton.vocalization;
          } else {
            delete newButton['vocalization'];
          }
          newButton.image_id = currentButton.image_id;
          newButton.sound_id = currentButton.sound_id;
          var bg = window.tinycolor(currentButton.background_color);
          if(bg._ok) {
            newButton.background_color = bg.toRgbString();
          }
          var border = window.tinycolor(currentButton.border_color);
          if(border._ok) {
            newButton.border_color = border.toRgbString();
          }
          newButton.hidden = !!currentButton.hidden;
          newButton.link_disabled = !!currentButton.link_disabled;
          if(currentButton.text_only) {
            newButton.text_only = true;
          } else {
            delete newButton['text_only'];
          }
          newButton.add_to_vocalization = !!currentButton.add_to_vocalization;
          if(currentButton.level_style) {
            if(currentButton.level_style == 'none') {
              emberSet(currentButton, 'level_modifications', null);
            } else if(currentButton.level_style == 'basic' && (currentButton.hidden_level || currentButton.link_disabled_level)) {
              var mods = emberGet(currentButton, 'level_modifications') || {};
              mods.pre = mods.pre || {};
              if(currentButton.hidden_level) {
                mods.pre['hidden'] = true;
                mods[currentButton.hidden_level.toString()] = {hidden: false};
              }
              if(currentButton.link_disabled_level) {
                mods.pre['link_disabled'] = true;
                mods[currentButton.link_disabled_level.toString()] = {link_disabled: false};
              }
              for(var ref_key in mods.pre) {
                var found_change = false;
                for(var level in mods) {
                  if(level != 'pre' && mods[level][ref_key] != undefined && mods[level][ref_key] != mods.pre[ref_key]) {
                    found_change = true;
                  }
                }
                if(!found_change) {
                  newButton[ref_key] = mods.pre[ref_key];
                  delete mods.pre[ref_key];
                }
              }
              emberSet(currentButton, 'level_modifications', mods);
            } else if(currentButton.level_json) {
              emberSet(currentButton, 'level_modifications', JSON.parse(currentButton.level_json));
            }
          }
          newButton.level_modifications = currentButton.level_modifications;
          newButton.home_lock = !!currentButton.home_lock;
          newButton.hide_label = !!currentButton.hide_label;
          newButton.blocking_speech = !!currentButton.blocking_speech;
          if(currentButton.get('translations.length') > 0) {
            newButton.translations = currentButton.get('translations');
          }
          if(currentButton.get('inflections.length') > 0) {
            newButton.inflections = currentButton.get('inflections');
          }
          if(currentButton.get('external_id')) {
            newButton.external_id = currentButton.get('external_id');
          }
          if(currentButton.part_of_speech) {
            newButton.part_of_speech = currentButton.part_of_speech;
            newButton.suggested_part_of_speech = currentButton.suggested_part_of_speech;
            newButton.painted_part_of_speech = currentButton.painted_part_of_speech;
          }
          if(currentButton.get('buttonAction') == 'talk') {
            delete newButton['load_board'];
            delete newButton['apps'];
            delete newButton['url'];
            delete newButton['integration'];
          } else if(currentButton.get('buttonAction') == 'link') {
            delete newButton['load_board'];
            delete newButton['apps'];
            delete newButton['integration'];
            newButton.url = currentButton.get('fixed_url');
            if(currentButton.get('video')) {
              newButton.video = currentButton.get('video');
            } else if(currentButton.get('book')) {
              newButton.book = currentButton.get('book');
            }
          } else if(currentButton.get('buttonAction') == 'app') {
            delete newButton['load_board'];
            delete newButton['url'];
            delete newButton['integration'];
            newButton.apps = currentButton.get('apps');
            if(newButton.apps.web && newButton.apps.web.launch_url) {
              newButton.apps.web.launch_url = currentButton.get('fixed_app_url');
            }
          } else if(currentButton.get('buttonAction') == 'integration') {
            delete newButton['load_board'];
            delete newButton['apps'];
            delete newButton['url'];
            newButton.integration = currentButton.get('integration');
          } else {
            delete newButton['url'];
            delete newButton['apps'];
            delete newButton['integration'];
            newButton.load_board = currentButton.load_board;
          }
          // newButton.top = ...
          // newButton.left = ...
          // newButton.width = ...
          // newButton.height = ...
          if(newButton.id < 0 || !newButton.id) {
            newButton.id = ++maxId;
          }
          newButton.id = newButton.id || ++maxId;
          for(var key in newButton) {
            if(newButton[key] === undefined) {
              delete newButton[key];
            }
          }
          newButtons.push(newButton);
          gridRow.push(newButton.id);
        } else {
          gridRow.push(null);
        }
      }
      gridOrder.push(gridRow);
    }
    return {
      grid: {
        rows: gridOrder.length,
        columns: gridOrder[0].length,
        order: gridOrder
      },
      buttons: newButtons
    };
  },
  lucky_symbols: function(ids) {
    var _this = this;
    ids.forEach(function(id) {
      var board_id = _this.controller.get('model.id');
      var button = _this.find_button(id);
      var force_refresh = button && button.label && button.image && (button.image.url || '').match(/empty_22_g/i) && !button.text_only;
      var needs_check = force_refresh || (button && button.label && !button.image && !button.local_image_url && !button.text_only);
      if(needs_check) {
        button.set('pending_image', true);
        button.set('pending', true);
        if(button && button.label && !button.image) {
          button.check_for_parts_of_speech();
        }
        var locale = _this.controller.get('model.locale') || 'en';
        contentGrabbers.pictureGrabber.picture_search(stashes.get('last_image_library'), button.label, _this.controller.get('model.user_name'), locale, true).then(function(data) {
          button = _this.find_button(id);
          var image = data[0];
          if(image && button && button.label && (!button.image || force_refresh)) {
            var license = {
              type: image.license,
              copyright_notice_url: image.license_url,
              source_url: image.source_url,
              author_name: image.author,
              author_url: image.author_url,
              uneditable: true
            };
            var preview = {
              url: persistence.normalize_url(image.image_url),
              content_type: image.content_type,
              suggestion: button.label,
              protected: image.protected,
              protected_source: image.protected_source,
              finding_user_name: image.finding_user_name,
              external_id: image.id,
              license: license
            };
            var save = contentGrabbers.pictureGrabber.save_image_preview(preview);

            save.then(function(image) {
              button = _this.find_button(id);
              if(_this.controller.get('model.id') == board_id && button && button.label && (!button.image || force_refresh)) {
                button.set('pending', false);
                button.set('pending_image', false);
                emberSet(button, 'image_id', image.id);
                emberSet(button, 'image', image);
              }
            }, function() {
              button.set('pending', false);
              button.set('pending_image', false);
            });
          } else if(button) {
            button.set('pending', false);
            button.set('pending_image', false);
          }
        }, function() {
          button.set('pending', false);
          button.set('pending_image', false);
          // nothing to do here, this can be a silent failure and it's ok
        });
      }
    });
  },
  lucky_symbol: function(id) {
    if(!this.controller || !app_state.get('edit_mode')) {
      this.lucky_symbol.pendingSymbols = this.lucky_symbol.pendingSymbols || [];
      this.lucky_symbol.pendingSymbols.push(id);
    } else {
      this.lucky_symbols([id]);
    }
  },
  stash_image: function(data) {
    this.stashedImage = data;
  },
  done_editing_image: function() {
    this.imageEditingCallback = null;
  },
  get_edited_image: function() {
    var _this = this;
    return new RSVP.Promise(function(resolve, reject) {
      if(_this.imageEditorSource) {
        var resolved = false;
        _this.imageEditingCallback = function(data) {
          resolved = true;
          resolve(data);
        };
        runLater(function() {
          if(!resolved) {
            reject({error: 'editor response timeout'});
          }
        }, 500);
        _this.imageEditorSource.postMessage('imageDataRequest', '*');
      } else {
        reject({editor: 'no editor found'});
      }
    });
  },
  edited_image_received: function(data) {
    if(this.imageEditingCallback) {
      this.imageEditingCallback(data);
    } else if(this.stashedBadge && this.badgeEditingCallback) {
      this.badgeEditingCallback(data);
    }
  },
  copy_board: function(old_board, decision, user, make_public, swap_library) {
    return new RSVP.Promise(function(resolve, reject) {
      var ids_to_copy = old_board.get('downstream_board_ids_to_copy') || [];
      var save = old_board.create_copy(user, make_public);
      if(decision == 'remove_links') {
        save = save.then(function(res) {
          res.get('buttons').forEach(function(b) {
            if(emberGet(b, 'load_board')) {
              emberSet(b, 'load_board', null);
            }
          });
          return res.save();
        });

      }
      save.then(function(board) {
        board.set('should_reload', true);
        var done_callback = function(result) {
          var affected_board_ids = result && result.affected_board_ids;
          var new_board_ids = result && result.new_board_ids;
          board.set('new_board_ids', new_board_ids);
          board.load_button_set(true);
          if(decision && decision.match(/as_home$/)) {
            user.set('preferences.home_board', {
              id: board.get('id'),
              key: board.get('key')
            });
            user.save().then(function() {
              resolve(board);
            }, function() {
              reject(i18n.t('user_home_failed', "Failed to update user's home board"));
            });
          } else if(decision && decision.match(/as_sidebar$/)) {
            var list = user.get('preferences.sidebar_boards');
            if(list) {
              list.forEach(function(side) {
                if(side.key == old_board.get('key') || side.id == old_board.get('id')) {
                  side.key = board.get('key');
                  side.id = board.get('id');
                }
              });
            }
            user.set('preferences.sidebar_boards', list);
            user.save().then(function() {
              resolve(board);
            }, function() {
              reject(i18n.t('user_sidebar_failed', "Failed to update user's sidebar"));
            });
          } else {
            resolve(board);
          }
          stashes.persist('last_index_browse', 'personal');
          old_board.reload_including_all_downstream(affected_board_ids);
        };
        var endpoint = null;
        if(decision == 'modify_links_update' || decision == 'modify_links_copy') {
          if((user.get('stats.board_set_ids') || []).indexOf(old_board.get('id')) >= 0) {
            endpoint = '/api/v1/users/' + user.get('id') + '/replace_board';
          } else if((user.get('stats.sidebar_board_ids') || []).indexOf(old_board.get('id')) >= 0) {
            endpoint = '/api/v1/users/' + user.get('id') + '/replace_board';
          }
        } else if(decision == 'links_copy' || decision == 'links_copy_as_home' || decision == 'links_copy_as_sidebar') {
          endpoint = '/api/v1/users/' + user.get('id') + '/copy_board_links';
        }
        if(endpoint) {
          persistence.ajax(endpoint, {
            type: 'POST',
            data: {
              old_board_id: old_board.get('id'),
              new_board_id: board.get('id'),
              update_inline: (decision == 'modify_links_update'),
              swap_library: swap_library,
              ids_to_copy: ids_to_copy.join(','),
              make_public: make_public
            }
          }).then(function(data) {
            progress_tracker.track(data.progress, function(event) {
              if(event.status == 'finished') {
                runLater(function() {
                  user.reload();
                  app_state.refresh_session_user();
                }, 100);
                done_callback(event.result);
              } else if(event.status == 'errored') {
                reject(i18n.t('re_linking_failed', "Board re-linking failed while processing"));
              }
            });
          }, function() {
            reject(i18n.t('re_linking_failed', "Board re-linking failed unexpectedly"));
          });
        } else {
          done_callback();
        }
      }, function(err) {
        reject(i18n.t('copying_failed', "Board copy failed unexpectedly"));
      });
    });
  },
  retrieve_badge: function() {
    var _this = this;
    return new RSVP.Promise(function(resolve, reject) {
      var state = null, data_url = null;
      if(_this.badgeEditorSource) {
        var resolved = false;
        _this.badgeEditingCallback = function(data) {
          if(data.match && data.match(/^data:/)) {
            data_url = data;
          }
          if(data && data.zoom) {
            state = data;
          }
          if(state && data_url) {
            _this.badgeEditingCallback.state = state;
            resolved = true;
            resolve(data_url);
          }
        };
        runLater(function() {
          if(!resolved && data_url) {
            resolve(data_url);
          } else if(!resolved) {
            reject({error: 'editor response timeout'});
          }
        }, 500);
        _this.badgeEditorSource.postMessage('imageDataRequest', '*');
        _this.badgeEditorSource.postMessage('imageStateRequest', '*');
      } else {
        reject({editor: 'no editor found'});
      }
    });
  }
}).create({
  history: [],
  future: [],
  lastChange: {},
  board: null
});

$(window).bind('message', function(event) {
  event = event.originalEvent || event;
  if(event.data && event.data.match && event.data.match(/^data:image/)) {
    editManager.edited_image_received(event.data);
  } else if(event.data && event.data.match && event.data.match(/state:{/)) {
    var str = event.data.replace(/^state:/, '');
    try {
      var json = JSON.parse(str);
      if(editManager.stashedBadge && editManager.badgeEditingCallback) {
        editManager.badgeEditingCallback(json);
      }
    } catch(e) { }
  } else if(event.data == 'imageDataRequest' && editManager.stashedImage) {
    editManager.imageEditorSource = event.source;
    event.source.postMessage(editManager.stashedImage.url, '*');
  } else if(event.data == 'wordStateRequest' && editManager.stashedImage) {
    editManager.imageEditorSource = event.source;
    event.source.postMessage("state:" + JSON.stringify(editManager.stashedImage), '*');
  } else if(event.data == 'imageURLRequest' && editManager.stashedBadge) {
    editManager.badgeEditorSource = event.source;
    if(editManager.stashedBadge && editManager.stashedBadge.image_url) {
      event.source.postMessage('https://opensymbols.s3.amazonaws.com/libraries/mulberry/bright.svg', '*');
    }
  } else if(event.data == 'imageStateRequest' && editManager.stashedBadge) {
    editManager.badgeEditorSource = event.source;
    if(editManager.stashedBadge && editManager.stashedBadge.state) {
      event.source.postMessage('state:' + JSON.stringify(editManager.stashedBadge.state));
    }
  }
});
window.editManager = editManager;
export default editManager;
