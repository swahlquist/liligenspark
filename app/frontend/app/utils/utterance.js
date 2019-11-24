import EmberObject from '@ember/object';
import {
  later as runLater,
  cancel as runCancel
} from '@ember/runloop';
import { set as emberSet, get as emberGet } from '@ember/object';
import i18n from './i18n';
import stashes from './_stashes';
import speecher from './speecher';
import app_state from './app_state';
import persistence from './persistence';
import $ from 'jquery';
import CoughDrop from '../app';
import { observer } from '@ember/object';

var punctuation_at_start = /^\+[\.\?\,\!]/;
var punctuation_with_space = /^\s*[\.\?\,\!]\s*$/;
var punctuation_at_end = /[\.\?\,\!]$/;
var punctuation_ending_sentence = /[\.\?\!]/;
var utterance = EmberObject.extend({
  setup: function(controller) {
    this.controller = controller;
    this.set('rawButtonList', stashes.get('working_vocalization'));
    this.set('app_state', app_state);
    app_state.addObserver('currentUser', this, this.update_voice);
    app_state.addObserver('currentUser.preferences.device.voice', this, this.update_voice);
    app_state.addObserver('currentUser.preferences.device.voice.volume', this, this.update_voice);
    app_state.addObserver('currentUser.preferences.device.voice.pitch', this, this.update_voice);
    app_state.addObserver('currentUser.preferences.device.voice.voiceURI', this, this.update_voice);
    app_state.addObserver('currentUser.preferences.clear_on_vocalize', this, this.update_voice);
//     this.set('clear_on_vocalize', window.user_preferences.any_user.clear_on_vocalize);
//     speecher.set_voice(window.user_preferences.device.voice);
    if(stashes.get('ghost_utterance')) {
      this.set('list_vocalized', true);
    }
  },
  update_voice: function() {
    var user = app_state.get('currentUser');
    if(user && user.get) {
      if(user.get && user.get('preferences.device.voice')) {
        user.update_voice_uri();
        speecher.set_voice(user.get('preferences.device.voice'), user.get('preferences.device.alternate_voice'));
      }
      this.set('clear_on_vocalize', user.get('preferences.clear_on_vocalize'));
    }
  },
  set_button_list: observer(
    'app_state.insertion.index',
    'rawButtonList',
    'rawButtonList.[]',
    'rawButtonList.length',
    'rawButtonList.@each.image',
    'hint_button',
    'hint_button.label',
    'hint_button.image_url',
    function() {
      var buttonList = [];
      var _this = this;
      var rawList = _this.get('rawButtonList');
      if(!rawList) { app_state.set('button_list', []); return; }
      for(var idx = 0; idx < rawList.length; idx++) {
        var button = rawList[idx];
        button.raw_index = idx;
        var last = rawList[idx - 1] || {};
        var last_computed = buttonList[buttonList.length - 1];
        var text = (button && (button.vocalization || button.label)) || '';

        var plusses = [], colons = [], inlines = [];
        if(button.specialty_with_modifiers) {
          var parts = text.split(/\s*&&\s*/);
          parts.forEach(function(text) {
            if(text.match(/^\+/)) {
              plusses.push(text);
            } else if(text.match(/^\:/)) {
              colons.push(text);
            }
          });
        }
        var regex = /.\s*:[^\s\&]+\s*./g;
        var group = null;
        while((group = regex.exec(text)) != null) {
          var txt = group[0];
          if(!txt.match(/^&/) || !txt.match(/&$/)) {
            var mod = txt.match(/:[^\s\&]+/);
            inlines.push([mod[0], group.index + mod.index]);
          }
        }
        
        var added = false;
        if(plusses.length > 0) {
          last = {};
          // Append to the last button if that one is still in progress,
          // or this is a punctuation mark, or it's part of a decimal number
          if(idx === 0 || last_computed.in_progress || plusses[0].match(punctuation_at_start) || ((last_computed.vocalization || last_computed.label).match(/[\.\,]$/) && plusses[0].match(/^\+\d/))) {
            last = buttonList.pop() || {};
          }
          // append to previous
          var altered = _this.modify_button(last, button);
          added = true;
          buttonList.push(altered);
        }
        var inline_actions = false;
        if(colons.length > 0) {
          colons.forEach(function(text) {
            last = buttonList.pop();
            if((text == ':complete' || text == ':predict') && !(last || {}).in_progress) {
              if(last) {
                buttonList.push(last);
              }
              last = {};
            }
            var action = CoughDrop.find_special_action(text);
            if(action && (action.modifier || action.completion) && !added) {
              var altered = _this.modify_button(last || {}, button);
              added = true;                           
              buttonList.push(altered);
            } else if(last) {
              buttonList.push(last);
            }
          });
        }
        if(inlines.length > 0) {
          inlines.forEach(function(arr) {
            var action = CoughDrop.find_special_action(arr[0]);
            if(action && action.inline) {
              inline_actions = inline_actions || [];
              action = Object.assign({}, action);
              action.str = arr[0];
              action.index = arr[1];
              inline_actions.unshift(action);
            }
          });
        }
        if(inline_actions && !button.inline_content) {
          rawList[idx].inline_content = utterance.combine_content(utterance.process_inline_content(text, inline_actions));
        }
        if(button.inline_content) {
          // Collect all the text components and inline components
          // and aggregate them together. Combine all adjacent text
          // components, then add the button as-is if no sounds
          // are attached, otherwise add a list of buttons as needed.
          // Mark the buttons as inline_generated so we don't
          // re-call .content() on future button adds/modifications
          var btn = Object.assign({}, button);
          btn.vocalization = button.inline_content.map(function(c) { return c.text; }).join(' ');
          added = true;
          buttonList.push(btn);
        }
        if(!added) {
          buttonList.push(rawList[idx]);
        }
      }
      var visualButtonList = [];
      var hint = null;
      if(utterance.get('hint_button')) {
        hint = EmberObject.create({label: utterance.get('hint_button.label'), image: utterance.get('hint_button.image_url'), ghost: true});
      }
      buttonList.forEach(function(button, idx) {
        var visualButton = EmberObject.create(button);
        visualButtonList.push(visualButton);
        if(button.image && button.image.match(/^http/)) {
          visualButton.set('original_image', button.image);
          persistence.find_url(button.image, 'image').then(function(data_uri) {
            visualButton.set('image', data_uri);
          }, function() { });
        }
        if(button.sound && button.sound.match(/^http/)) {
          visualButton.set('original_sound', button.sound);
          persistence.find_url(button.sound, 'sound').then(function(data_uri) {
            visualButton.set('sound', data_uri);
          }, function() { });
        }
        visualButton.set('label', visualButton.get('label').replace(/\s$/g, ''));
        if(visualButton.get('vocalization')) {
          visualButton.set('vocalization', visualButton.get('vocalization').replace(/\s$/g, ''));
        }
        if(app_state.get('insertion.index') == idx) {
          visualButton.set('insert_after', true);
          if(hint) {
            visualButtonList.push(hint);
            hint = null;
          }
        } else if(app_state.get('insertion.index') == -1 && idx == 0) {
          visualButton.set('insert_before', true);
          if(hint) {
            visualButtonList.unshift(hint);
            hint = null;
          }
        }
      });
      var idx = Math.min(Math.max(app_state.get('insertion.index') || visualButtonList.length - 1, 0), visualButtonList.length - 1);
      var last_spoken_button = visualButtonList[idx];
      // If the last event was a punctuation mark, speak the whole last sentence
      if(last_spoken_button && !last_spoken_button.blocking_speech && (last_spoken_button.vocalization || last_spoken_button.label || "").match(punctuation_at_end)) {
        var prior = utterance.sentence(visualButtonList.slice(0, -1));
        var parts = prior.split(punctuation_ending_sentence);
        var last_part = parts[parts.length - 1];
        var str = last_part + " " + (last_spoken_button.vocalization || last_spoken_button.label);
        last_spoken_button = {
          label: str
        };
      }
      if(hint) {
        visualButtonList.push(hint);
      }
      app_state.set('button_list', visualButtonList);
      utterance.set('last_spoken_button', last_spoken_button);
      stashes.persist('working_vocalization', buttonList);
    }
  ),
  process_inline_content: function(text, inline_actions) {
    var content = [];
    var loc = 0;
    inline_actions.sortBy('index').forEach(function(action) {
      var pre = text.slice(loc, action.index);
      if(pre && !pre.match(/^\s*$/)) {
        content.push({text: pre});
      }
      loc = action.index + action.str.length;
      if(action.match) {
        content = content.concat(action.content(action.str.match(action.match)));
      } else {
        content = content.concat(action.content(action.str));
      }
    });
    var left = text.slice(loc);
    if(left && !left.match(/^\s*$/)) {
      content.push({text: left});
    }
    return content;
  },
  combine_content: function(content) {
    var final_content = [];
    var text_pad = null;
    var clear_pad = function() {
      if(text_pad) { final_content.push({text: text_pad}); text_pad = null; }
    };
    for(var jdx = 0; jdx < content.length; jdx++) {
      var content_text = content[jdx].text.toString();
      if(content[jdx].sound_url) {
        clear_pad();
        final_content.push(content[jdx]);
      } else if(content_text && text_pad) {
        text_pad = (text_pad || '').replace(/\s+$/, '') + " " + content_text.replace(/^\s+/, '');
      } else if(content_text) {
        text_pad = content_text.replace(/^\s+/, '');
      }
    }
    clear_pad();
    return final_content;
  },
  update_hint: observer('hint_button.label', function() {
    if(this.get('hint_button.label')) {
//      console.error("hint button!", this.get('hint_button.label'));
      // temporarily show hint overlay
    } else {
//      console.error("hint button cleared");
      // clear hint overlay
    }
  }),
  modify_button: function(original, addition) {
    addition.mod_id = addition.mod_id || Math.round(Math.random() * 9999);
    if(original && original.modifications && original.modifications.find(function(m) { return addition.button_id == m.button_id && m.mod_id == addition.mod_id; })) {
      return original;
    }

    var altered = $.extend({}, original);

    altered.modified = true;
    altered.button_id = altered.button_id || addition.button_id;
    altered.sound = null;
    altered.board = altered.board || addition.board;
    altered.modifications = altered.modifications || [];
    altered.modifications.push(addition);

    var parts = (addition.vocalization || addition.label || '').split(/\s*&&\s*/);
    parts.forEach(function(text) {
      if(text && text.length > 0) {
        var prior_text = (altered.vocalization || altered.label || '');
        var prior_label = (altered.label || '');
        var action = CoughDrop.find_special_action(text);
    
        if(text.match(/^\+/) && (altered.in_progress || !prior_text || text.match(punctuation_at_start))) {
          altered.vocalization = prior_text + text.substring(1);
          altered.label = prior_label + text.substring(1);
          altered.in_progress = !altered.vocalization.match(punctuation_at_end);
        } else if(action && action.alter) {
          action.alter(text, prior_text, prior_label, altered, addition);
        }
    
      }
    });

    var filler = 'https://opensymbols.s3.amazonaws.com/libraries/mulberry/pencil%20and%20paper%202.svg';
    altered.image = altered.image || filler;
    if(!altered.in_progress && altered.image == filler) {
      altered.image = 'https://opensymbols.s3.amazonaws.com/libraries/mulberry/paper.svg';
    }
    return altered;
  },
  specialty_button: function(button) {
    var vocs = [];
    (button.vocalization || '').split(/\s*&&\s*/).forEach(function(mod) {
      if(mod && mod.length > 0) { vocs.push(mod); }
    });
    var specialty = null;
    vocs.forEach(function(voc) {
      var action = CoughDrop.find_special_action(voc);
      if(action && !action.completion && !action.modifier && !action.inline) {
        if(action.has_sound) {
          button.has_sound = true;
        }
        specialty = button;
        var any_special = true;
      } else if((voc.match(/^\+/) || voc.match(/^:/)) && voc != ':native-keyboard') {
        button.specialty_with_modifiers = true;
        if(voc.match(/^\+/) || (action && action.completion)) {
          button.default_speak = true;
        } else if(action && action.modifier) {
          button.default_speak = true;
        }
        specialty = button;
      } else {
        if(button.default_speak) {
          button.default_speak = button.default_speak + " " + voc;
        } else {
          button.default_speak = voc;
        }
      }
    });
    return specialty;
  },
  add_button: function(button, original_button) {
    // clear if the sentence box was already spoken and auto-clear is enabled
    if(this.get('clear_on_vocalize') && this.get('list_vocalized')) {
      this.clear({auto_cleared: true});
    }
    // append button attributes as needed
    var b = $.extend({}, button);
    if(original_button && original_button.load_image) {
      original_button.load_image('local').then(function(image) {
        image = image || original_button.get('image');
        if(image) {
          emberSet(b, 'image', image.get('best_url'));
          emberSet(b, 'image_license', image.get('license'));
        }
      });
      original_button.load_sound('local').then(function(sound) {
        sound = sound || original_button.get('sound');
        if(sound) {
          emberSet(b, 'sound', sound.get('best_url'));
          emberSet(b, 'sound_license', sound.get('license'));
        }
      });
    }
    // add button to the raw button list
    var list = this.get('rawButtonList');
    var idx = app_state.get('insertion.index');
    if(app_state.get('insertion') && isFinite(idx)) {
      // insertion.index is for the visual list, which has 
      // different items than the raw list
      var button = app_state.get('button_list')[idx];
      var raw_index = button && button.raw_index;
      if(button) {
        if(button.modifications) {
          raw_index = button.modifications[button.modifications.length - 1].raw_index || (raw_index + button.modifications.length);
        }
        list.insertAt(raw_index + 1, b);
      }
      if(!b.specialty_with_modifiers) {
        app_state.set('insertion.index', Math.min(list.length - 1, idx + 1));
      }
    } else {
      list.pushObject(b);
    }
    this.set('list_vocalized', false);
    // retrieve the correct result from the now-updated button list
    // should return whatever it is the vocalization is supposed to say
    return utterance.get('last_spoken_button');
  },
  speak_button: function(button) {
    var alt_voice = speecher.alternate_voice && speecher.alternate_voice.enabled && speecher.alternate_voice.for_buttons === true;
    if(button.sound) {
      var collection_id = null;
      if(button.blocking_speech) {
        collection_id = Math.round(Math.random() * 99999) + "-" + (new Date()).getTime();
      }
      speecher.speak_audio(button.sound, 'text', collection_id, {alternate_voice: alt_voice});
    } else {
      if(speecher.ready) {
        if(button.vocalization == ":beep") {
          speecher.beep();
        } else {
          var collection_id = null;
          if(button.blocking_speech) {
            collection_id = Math.round(Math.random() * 99999) + "-" + (new Date()).getTime();
          }
          if(button.inline_content) {
            var items = [];
            var list = button.inline_content;
            for(var idx = 0; idx < list.length; idx++) {
              if(list[idx].sound_url) {
                var url = list[idx].sound_url;
                if(url.match(/_url$/)) { url = speecher[url]; }
                items.push({sound: url});
              } else {
                items.push({text: list[idx].text});
              }
            }
            speecher.speak_collection(items, collection_id, {alternate_voice: alt_voice});
          } else {
            var text = button.vocalization || button.label;
            speecher.speak_text(text, collection_id, {alternate_voice: alt_voice});
          }
        }
      } else {
        this.silent_speak_button(button);
      }
    }
  },
  sentence: function(u) {
    return u.map(function(b) { return b.vocalization || b.label; }).join(" ");
  },
  silent_speak_button: function(button) {
    var selector = '#speak_mode';
    if(app_state.get('speak_mode')) {
      selector = '#button_list';
    }
    if(!$(selector).attr('data-popover')) {
      $(selector).attr('data-popover', true).popover({html: true});
    }
    runCancel(this._popoverHide);
    var str = button.vocalization || button.label;
    var text = "\"" + $('<div/>').text(str).html() + "\"";
    if(button.sound) {
      text = text + " <span class='glyphicon glyphicon-volume-up'></span>";
    }
    $(selector).attr('data-content', text).popover('show');

    this._popoverHide = runLater(this, function() {
      $(selector).popover('hide');
    }, 2000);
  },
  speak_text: function(text) {
    if(text == ':beep') {
      speecher.beep();
    } else {
      speecher.speak_text(text);
    }
  },
  alert: function(opts) {
    speecher.beep(opts);
  },
  clear: function(opts) {
    opts = opts || {}
    if(app_state.get('reply_note') && this.get('rawButtonList.length') == 0) {
      app_state.set('reply_note', null);
    }
    app_state.set('insertion', null);
    this.set('rawButtonList', []);
    var audio = [];
    if(document.getElementById('button_list')) {
      audio = document.getElementById('button_list').getElementsByTagName('AUDIO');
    }
    for(var idx = audio.length - 1; idx >= 0; idx--) {
      audio[idx].parentNode.removeChild(audio[idx]);
    }
    $("#button_list audio")
    if(!opts.skip_logging) {
      stashes.log({
        action: 'clear',
        button_triggered: opts.button_triggered
      });
    }
    if(!opts.auto_cleared) {
      speecher.stop('all');
    }
    this.set('list_vocalized', false);
  },
  backspace: function(opts) {
    opts = opts || {};
    var list = this.get('rawButtonList');
    // if the list is vocalized, backspace should take it back into building-mode
    if(!this.get('list_vocalized')) {
      var idx = app_state.get('insertion.index');
      if(app_state.get('insertion') && isFinite(idx)) {
        // insertion.index is for the visual list, which has 
        // different items than the raw list
        var button = app_state.get('button_list')[idx];
        var raw_index = button && button.raw_index;
        var move_index = true;
        if(button) {
          if(button.modifications) {
            raw_index = button.modifications[button.modifications.length - 1].raw_index || (raw_index + button.modifications.length);
            move_index = false;
          }
          list.removeAt(raw_index);
        }
        if(move_index) {
          app_state.set('insertion.index', Math.max(-1, idx - 1));
        }
      } else {
        list.popObject();
      }
    } else {
      speecher.stop('all');
    }
    stashes.log({
      action: 'backspace',
      button_triggered: opts.button_triggered
    });
    this.set('list_vocalized', false);
  },
  set_and_say_buttons: function(buttons) {
    this.set('rawButtonList', buttons);
    this.controller.vocalize();
  },
  vocalize_list: function(volume, opts) {
    opts = opts || {};
    var list = app_state.get('button_list');
    var text = list.map(function(i) { return i.vocalization || i.label; }).join(' ');
    var items = [];
    for(var idx = 0; idx < list.length; idx++) {
      if(list[idx].inline_content) {
        list[idx].inline_content.forEach(function(content) {
          if(content.sound_url) {
            var url = content.sound_url;
            if(url.match(/_url$/)) { url = speecher[url]; }
            items.push({sound: url});
          } else if(content.text) {
            items.push({text: content.text, volume: volume});
          }
        });
      } else if(list[idx].sound) {
        items.push({sound: list[idx].sound});
      } else if(items.length && items[items.length - 1].text) {
        var item = items.pop();
        items.push({text: item.text + ' ' + (list[idx].vocalization || list[idx].label), volume: volume});
      } else {
        items.push({text: (list[idx].vocalization || list[idx].label), volume: volume});
      }
    }

    stashes.log({
      text: text,
      button_triggered: opts.button_triggered,
      buttons: stashes.get('working_vocalization')
    });
    app_state.set('insertion', null);
    speecher.speak_collection(items, Math.round(Math.random() * 99999) + '-' + (new Date()).getTime(), {override_volume: volume});
    $("#hidden_input").val("");
    this.set('list_vocalized', true);
  },
  set_ghost_utterance: observer('list_vocalized', 'clear_on_vocalize', function() {
    stashes.persist('ghost_utterance', !!(this.get('list_vocalized') && this.get('clear_on_vocalize')));
  }),
  test_voice: function(voiceURI, rate, pitch, volume, target) {
    rate = parseFloat(rate);
    if(isNaN(rate)) { rate = 1.0; }
    pitch = parseFloat(pitch);
    if(isNaN(pitch)) { pitch = 1.0; }
    volume = parseFloat(volume);
    if(isNaN(volume)) { volume = 1.0; }

    speecher.speak_text(i18n.t('do_you_like_voice', "Do you like my voice?"), 'test-' + voiceURI, {
      volume: volume,
      pitch: pitch,
      rate: rate,
      voiceURI: voiceURI,
      default_prompt: true,
      target: target
    });
  }
}).create({scope: (window.polyspeech || window)});

export default utterance;
