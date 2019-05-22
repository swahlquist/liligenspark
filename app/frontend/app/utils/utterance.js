import Ember from 'ember';
import EmberObject from '@ember/object';
import { later as runLater, cancel as runCancel } from '@ember/runloop';
import {set as emberSet, get as emberGet} from '@ember/object';
import i18n from './i18n';
import stashes from './_stashes';
import speecher from './speecher';
import app_state from './app_state';
import persistence from './persistence';
import $ from 'jquery';
import CoughDrop from '../app';

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
  set_button_list: function() {
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
      // TODO: this used to check whether the last button was a sound,
      // but I have no idea why.
      var plusses = [], colons = [];
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
      var added = false;
      if(plusses.length > 0) {
        last = {};
        if(idx === 0 || last_computed.in_progress) {
          last = buttonList.pop() || {};
        }
        // append to previous
        var altered = _this.modify_button(last, button);
        added = true;
        buttonList.push(altered);
      }
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
        persistence.find_url(button.sound, 'image').then(function(data_uri) {
          visualButton.set('sound', data_uri);
        }, function() { });
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
    if(last_spoken_button && (last_spoken_button.vocalization || last_spoken_button.label || "").match(/^\s*[\.\?\,\!]\s*$/)) {
      var prior = utterance.sentence(visualButtonList.slice(0, -1));
      var parts = prior.split(/[\.\?\!]/);
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
  }.observes('app_state.insertion.index', 'rawButtonList', 'rawButtonList.[]', 'rawButtonList.length', 'rawButtonList.@each.image', 'hint_button', 'hint_button.label', 'hint_button.image_url'),
  update_hint: function() {
    if(this.get('hint_button.label')) {
//      console.error("hint button!", this.get('hint_button.label'));
      // temporarily show hint overlay
    } else {
//      console.error("hint button cleared");
      // clear hint overlay
    }
  }.observes('hint_button.label'),
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
    
        if(text.match(/^\+/) && (altered.in_progress || !prior_text)) {
          altered.vocalization = prior_text + text.substring(1);
          altered.label = prior_label + text.substring(1);
          altered.in_progress = true;
        } else if(action && action.alter) {
          action.alter(text, prior_text, prior_label, altered, addition);
        }
    
      }
    });

    var filler = 'https://s3.amazonaws.com/opensymbols/libraries/mulberry/pencil%20and%20paper%202.svg';
    altered.image = altered.image || filler;
    if(!altered.in_progress && altered.image == filler) {
      altered.image = 'https://s3.amazonaws.com/opensymbols/libraries/mulberry/paper.svg';
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
      if(action && !action.completion && !action.modifier) {
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
      original_button.load_image().then(function(image) {
        image = image || original_button.get('image');
        if(image) {
          emberSet(b, 'image', image.get('best_url'));
          emberSet(b, 'image_license', image.get('license'));
        }
      });
      original_button.load_sound().then(function(sound) {
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
    if(button.sound) {
      var collection_id = null;
      if(button.blocking_speech) {
        collection_id = Math.round(Math.random() * 99999) + "-" + (new Date()).getTime();
      }
      speecher.speak_audio(button.sound, 'text', collection_id);
    } else {
      if(speecher.ready) {
        if(button.vocalization == ":beep") {
          speecher.beep();
        } else {
          var collection_id = null;
          if(button.blocking_speech) {
            collection_id = Math.round(Math.random() * 99999) + "-" + (new Date()).getTime();
          }
          var text = button.vocalization || button.label;
          speecher.speak_text(text, collection_id);
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
    // TODO: this is ignoring volume right now :-(
    var list = app_state.get('button_list');
    var text = list.map(function(i) { return i.vocalization || i.label; }).join(' ');
    var items = [];
    for(var idx = 0; idx < list.length; idx++) {
      if(list[idx].sound) {
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
    this.set('list_vocalized', true);
  },
  set_ghost_utterance: function() {
    stashes.persist('ghost_utterance', !!(this.get('list_vocalized') && this.get('clear_on_vocalize')));
  }.observes('list_vocalized', 'clear_on_vocalize'),
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
