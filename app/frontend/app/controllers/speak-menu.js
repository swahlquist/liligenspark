import { later as runLater } from '@ember/runloop';
import $ from 'jquery';
import modal from '../utils/modal';
import stashes from '../utils/_stashes';
import app_state from '../utils/app_state';
import utterance from '../utils/utterance';
import speecher from '../utils/speecher';
import { set as emberSet } from '@ember/object';
import capabilities from '../utils/capabilities';
import CoughDrop from '../app';
import { computed } from '@ember/object';
import i18n from '../utils/i18n';

export default modal.ModalController.extend({
  opening: function() {
    var utterances = stashes.get('remembered_vocalizations') || [];
    if(app_state.get('currentUser')) {
      utterances = utterances.filter(function(u) { return u.stash; }).slice(0, 2);
      (app_state.get('currentUser.vocalizations') || []).filter(function(v) { return !v.category || v.category == 'default'; }).forEach(function(u) {
        utterances.push({
          sentence: u.list.map(function(v) { return v.label; }).join(" "),
          vocalizations: u.list,
          stash: false
        });
      });
    }
    this.set('model', {});
    this.set('punctuation_menu', false);
    this.set('repeat_menu', false);
    this.set('rememberedUtterances', utterances.slice(0, 7));
    var height = app_state.get('header_height');
    $("#speak_menu").closest(".modal-dialog").css('top', (height - 40) + 'px');
    runLater(function() {
      $("#speak_menu").closest(".modal-dialog").css('top', (height - 40) + 'px');
    }, 100);
  },
  sharing_allowed: computed(
    'app_state.currentUser',
    'app_state.currentUser.preferences.sharing',
    function() {
      return (!this.get('app_state.currentUser') && window.user_preferences.any_user.sharing) || this.get('app_state.currentUser.preferences.sharing');
    }
  ),
  working_vocalization_text: computed('stashes.working_vocalization', function() {
    var buttons = stashes.get('working_vocalization') || [{label: "no text"}];
    return buttons.map(function(b) { return b.label; }).join(" ");
  }),
  contraction: computed('working_vocalization_text', function() {
    var buttons = app_state.get('button_list').slice(-2);
    var str_2 = buttons.map(function(b) { return b.label; }).join(' ');
    var str_1 = buttons[buttons.length - 1].label;
    var res = null;
    for(var words in i18n.substitutions.contractions) {
      if(!res) {
        var words_minus_last = words.split(/\s+/).slice(0, -1).join(' ');
        if(words.length > 0 && str_2 == words) {
          res = {lookback: words.split(/\s+/).length, label: i18n.substitutions.contractions[words]};
        } else if(words_minus_last.length > 0 && str_1 == words_minus_last) {
          res = {lookback: words_minus_last.split(/\s+/).length, label: i18n.substitutions.contractions[words]};
        }
      }
    }
    if(!res) {
      var last = buttons.slice(-1)[0];
      if(last && last.part_of_speech == 'noun') {
        res = {lookback: 1, label: last.label + "'s"};
      }
    }
    return res || {clearback: 0, label: "don't"};
  }),
  actions: {
    selectButton: function(button) {
      modal.close(true);
      if(button == 'remember') {
        app_state.save_phrase(stashes.get('working_vocalization'));
      } else if(button == 'share') {
        if(stashes.get('working_vocalization.length')) {
          modal.open('share-utterance', {utterance: stashes.get('working_vocalization')});
        }
      } else if(button == 'sayLouder') {
        app_state.say_louder();
      } else {
        var existing = [].concat(stashes.get('working_vocalization') || []);
        var ids = existing.map(function(b){ return b.button_id + ":" + (b.board || {}).id}).join('::');
        var already_there = (stashes.get('remembered_vocalizations') || []).find(function(list) { 
          return ids == (list.vocalizations || []).map(function(b) { return b.button_id + ":" + (b.board || {}).id}).join('::');
        });
        if(button.stash) {
          // If there is a working vocalization, swap it into the stash
          // when you swap this one out
          utterance.set('rawButtonList', button.vocalizations);
          utterance.set('list_vocalized', false);
          var list = (stashes.get('remembered_vocalizations') || []).filter(function(v) { return !v.stash && v.sentence != button.sentence; });
          stashes.persist('remembered_vocalizations', list);
          if(existing.length > 0 && !already_there) {
            stashes.remember({override: existing, stash: true});
          }
        } else {
          // If there is nothing in the held thought,
          // but there is a working vocalization, stash it
          if(existing.length > 0 && !(stashes.get('remembered_vocalizations') || []).find(function(v) { return v.stash; })) {
            stashes.remember({override: existing, stash: true});
          }
          app_state.set_and_say_buttons(button.vocalizations);
        }
      }
    },
    end_insertion: function() {
      app_state.set('insertion', null);
      modal.close();
    },
    reply_note: function() {
      if(app_state.get('reply_note')) {
        var user = app_state.get('reply_note.author');
        if(user) {
          emberSet(user, 'user_name', user.user_name || user.name);
          emberSet(user, 'avatar_url', user.avatar_url || user.image_url);
          var voc = stashes.get('working_vocalization') || [];
          var sentence = voc.map(function(v) { return v.label; }).join(' ');
          modal.open('confirm-notify-user', {user: user, reply_id: app_state.get('reply_note.id'), raw: stashes.get('working_vocalization'), sentence: sentence, utterance: null, scannable: true});
        }
      }
    },
    flip_text: function() {
      app_state.flip_text();
      modal.close(true);
    },
    button_event: function(event, button, full_event) {
      if(event == 'speakMenuSelect') {
        var click = function() {
          if(app_state.get('currentUser.preferences.click_buttons') && app_state.get('speak_mode')) {
            speecher.click();
          }
          if(app_state.get('currentUser.preferences.vibrate_buttons') && app_state.get('speak_mode')) {
            capabilities.vibrate();
          }
        };
        if(button != 'menu_repeat_button' && button != 'menu_punctuation_button') {
          modal.close(true);
        }
        if(button == 'menu_share_button') {
          modal.open('share-utterance', {utterance: stashes.get('working_vocalization'), inactivity_timeout: true, scannable: true});
          click();
        } else if(button == 'menu_repeat_button') {
          if(full_event.swipe_direction) {
            modal.close(true);
            if(full_event.swipe_direction == 'e') {
              app_state.say_louder();
            } else if(full_event.swipe_direction == 'w') {
              app_state.say_louder(0.3);
            } else if(full_event.swipe_direction == 'n') {
              click();
              app_state.flip_text();
            } else if(full_event.swipe_direction == 's') {
              click();
              modal.open('modals/big-button', {text: this.get('working_vocalization_text'), text_only: app_state.get('referenced_user.preferences.device.button_text_position') == 'text_only'});
            }
          } else {
            this.set('repeat_menu', !this.get('repeat_menu'));
          }

          // right for louder, left for quieter, down for big button target, up for flip text
        } else if(button == 'menu_repeat_louder') {
          app_state.say_louder();
        } else if(button == 'menu_repeat_quieter') {
          app_state.say_louder(0.3);
        } else if(button == 'menu_repeat_text') {
          click();
          modal.open('modals/big-button', {text: this.get('working_vocalization_text'), text_only: app_state.get('referenced_user.preferences.device.button_text_position') == 'text_only'});
        } else if(button == 'menu_repeat_flip') {
          click();
          app_state.flip_text();
        } else if(button == 'menu_hold_thought_button') {
          stashes.remember({stash: true});
          utterance.clear();
          click();
        } else if(button == 'menu_phrases_button') {
          modal.open('modals/phrases', {inactivity_timeout: true, scannable: true});
          click();
        } else if(button == 'menu_inbox_button') {
          modal.open('modals/inbox', {inactivity_timeout: true, scannable: true});
          click();
        } else if(button == 'menu_repair_button') {
          modal.open('modals/repairs', {inactivity_timeout: true, scannable: true});
          click();
        } else if(button == 'menu_contraction_button') {
          var contraction = this.get('contraction');
          var rawList = utterance.get('rawButtonList');
          var to_remove = [];
          if(contraction.lookback > 0) {
            var buttons = app_state.get('button_list').slice(0 - contraction.lookback);
            var last = buttons[buttons.length - 1] || {};
            last = last.modifications ? (last.modifications[last.modifications.length - 1].raw_index) : last.raw_index;
            var first = buttons[0] || {};
            first = first.modifications ? (first.modifications[0].raw_index) : first.raw_index;
            var count  =  (last - first) + 1;
            to_remove = rawList.slice(0 - count);
            rawList = rawList.slice(0, 0 - count);
            utterance.set('rawButtonList', rawList);
          }
          app_state.activate_button({label: contraction.label}, {
            label: contraction.label,
            prevent_return: true,
            button_id: null,
            pre_substitution: to_remove,
            source: 'speak_menu',
            board: {id: 'speak_menu', key: 'core/speak_menu'},
            type: 'speak'
          });
        } else if(button == 'menu_quote_button') {
          utterance.add_button({label: "\"", vocalization: "+\""});
          click();
        } else if(button == 'menu_colon_button') {
          utterance.add_button({label: ":", vocalization: "+: "});
          click();
        } else if(button == 'menu_exclamation_button') {
          app_state.activate_button({vocalization: '+!'}, {
            label: '!',
            vocalization: '+!',
            prevent_return: true,
            button_id: null,
            source: 'speak_menu',
            board: {id: 'speak_menu', key: 'core/speak_menu'},
            type: 'speak'
          });
        } else if(button == 'menu_comma_button') {
          utterance.add_button({label: ",", vocalization: "+,"});
          click();
        } else if(button == 'menu_question_button') {
          app_state.activate_button({vocalization: '+?'}, {
            label: '?',
            vocalization: '+?',
            prevent_return: true,
            button_id: null,
            source: 'speak_menu',
            board: {id: 'speak_menu', key: 'core/speak_menu'},
            type: 'speak'
          });
        } else if(button == 'menu_period_button') {
          app_state.activate_button({vocalization: '+.'}, {
            label: '.',
            vocalization: '+.',
            prevent_return: true,
            button_id: null,
            source: 'speak_menu',
            board: {id: 'speak_menu', key: 'core/speak_menu'},
            type: 'speak'
          });
        } else if(button == 'menu_punctuation_button') {
          this.set('ref', Math.random());
          this.set('punctuation_menu', !this.get('punctuation_menu'));
          click();
        } else {
          console.error("unrecognized button", button);
        }
      }
    },
    close: function() {
      modal.set('speak_menu_last_closed', Date.now());
      modal.close();
    }
  },
});
