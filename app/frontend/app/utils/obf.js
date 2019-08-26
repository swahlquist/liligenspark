import Ember from 'ember';
import EmberObject from '@ember/object';
import CoughDrop from '../app';

var handlers = {};
var obf = EmberObject.extend({
  parse: function(json) {
    var board = CoughDrop.store.createRecord('board');
    board.set('local_only', true);
    var hash = JSON.parse(json);
    var buttons = [];
    board.set('grid', hash['grid']);
    board.set('id', 'b123'); // TODO: ...
    board.set('permissions', {view: true});
    board.set('background_image_url', hash['background_image_url']);
    board.set('background_position', hash['background_position']);
    board.set('background_text', hash['background_text']);
    board.set('background_prompt', hash['background_prompt']);

    board.set('hide_empty', true);
    board.key = "obf/whatever"; // TODO: ...
    var image_urls = {};
    var sound_urls = {};
    var buttons = [];
    (hash['buttons'] || []).forEach(function(b) {
      var img = b.image_id && hash['images'].find(function(i) { return i.id == b.image_id; });
      if(img) { image_urls[b.image_id] = img.url; }
      var snd = b.sound_id && hash['sounds'].find(function(s) { return s.id == b.sound_id; });
      if(snd) { sound_urls[b.sound_id] = snd.url; }
      buttons.push(b);
      // TODO: include attributions somewhere
    });
    board.set('buttons', buttons);
    board.set('image_urls', image_urls);
    board.set('sound_urls', sound_urls);
    return board;
  },
  register: function(prefix, callback) {
    handlers[prefix] = callback;
  },
  lookup: function(key) {
    for(var prefix in handlers) {
      var re = new RegExp("^" + prefix);
      if(key.match(re)) {
        var json = handlers[prefix](key);
        return obf.parse(json);
      }
    }
    return null;
  },
  shell: function(rows, columns) {
    var grid = [];
    for(var idx = 0; idx < rows; idx++) {
      var row = [];
      for(var jdx = 0; jdx < columns; jdx++) {
        row.push(null);
      }
      grid.push(row);
    }
    var shell = {
      format: 'open-board-0.1',
      license: {type: 'private'},
      buttons: [],
      grid: {
        rows: rows,
        columns: columns,
        order: grid
      },
      images: [],
      sounds: []
    };
    shell.id_index = 0;
    shell.to_json = function() {
      return JSON.stringify(shell, 2);
    };
    shell.add_button = function(button, row, col) {
      button.id = "btn_" + (++shell.id_index);
      if(button.image) {
        var img = Object.assign({}, button.image);
        img.id = "img_" + (++shell.id_index);
        shell.images.push(img);
        button.image_id = img.id;
        delete button['image'];
      }
      if(button.sound) {
        var snd = Object.assign({}, button.sound);
        snd.id = "snd_" + (++shell.id_index);
        shell.sounds.push(snd);
        button.sound_id = snd.id;
        delete button['sound'];
      }
      shell.buttons.push(button);
      shell.grid.order[row][col] = button.id;
    };
    return shell;
  }
}).create();
obf.register("eval", function(key) {
  // What we want to know:
  // - How small of a button can they handle?
  // - How many buttons per screen can they handle?
  // - Can they handle symbols or photos better?
  // - Can they pick up and start using a new board set?
  // - Can they read? At what level? Single words, sentences?
  // - Is it possible to end with a recommendation?
  // Start w/ brief introduction and explanation for each assessment
  // (navigation for start, skip, too difficult)
  // Visual Identification
  //   field of 2, 3, 4, 8, 15, 24, 32, 45 (w/ XL, L, M, S button sizes)
  //   only the one correct symbol is shown
  //   on the harder tests or if they fail, try more than once
  // Visual Discrimination
  //   same but full of distractors
  // Noun Vocabulary
  //   field of 3, find the [noun]
  //   (with/without words on the buttons, but maybe words in prompt)
  // Function Vocabulary
  //   field of 3, "find the one you..."
  // Verb Vocabulary
  //   field of 3, find [verb]
  // Category Recognition
  //   field of 3, "find the one that ____ goes with"
  // Word Association
  //   field of 3, "what goes with the ____"
  // Category Inclusion
  //   field of 3, "find the one that is a ______"
  // Category Exclusion
  //   field of 3, "find the one that is not a ______"
  // Core Vocabulary
  //   field of 4/8, "find the word ______"
  // Picture Description
  //   mini-core board, make observations about the picture
  //   the sentences are recorded, rather than being auto-scored,
  //   but it does track # of utterances, # of words, MLU
  // Word Prediction
  //   text-based buttons, "find the word that matches this picture"
  // Settings: 
  // - auto/manual advance to next
  // - picture to prompt for
  var board = null;
  if(key == 'eval') {
    board = obf.shell(4, 4);
    board.background_image_url = "https://thetechnoskeptic.com/wp-content/uploads/2019/03/NightSky_iStock_den-belitsky_900.jpg";
    board.background_position = "stretch,1,1,2,2";
    board.background_text = "This is some super\ncool text!";
    board.background_prompt = {
      text: "Find the cat",
//      sound_url: "https://sample-videos.com/audio/mp3/crowd-cheering.mp3",
      loop: true
    };
    board.add_button({
      label: 'cat', 
      image: {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f431.svg"}, 
      sound: {}
    }, 0, Math.floor(Math.random() * 4));
    board.add_button({
      label: 'rat', 
      image: {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f400.svg"}, 
      sound: {}
    }, 3, Math.floor(Math.random() * 4));
    board.add_button({
      label: '', 
    }, 2, 1);
  }
  // TODO: need settings for:
  // - force blank buttons to be hidden
  // - background image (url, grid range, cover or center)
  // - text description (same area, over the top of bg)
  if(board) {
    return board.to_json();
  }
  return null;
});
obf.register("emergency", function(key) {

});
window.obf = obf;

export default obf;
