import Ember from 'ember';
import EmberObject from '@ember/object';
import CoughDrop from '../app';
import evaluation from './eval';

// allow user-defined prompt image/label
// in the user menu add options for "repeat prompt", "end this section", "skip this step", "end assessment"
// select language when starting assessment
// track full duration of the assessment
// prevent home button while in evaluation
// way to go back to a previous section

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
    board.set('background_image_exclusion', hash['background_image_exclusion']);
    board.set('background_position', hash['background_position']);
    board.set('background_text', hash['background_text']);
    board.set('background_prompt', hash['background_prompt']);
    board.set('text_only', hash['text_only']);

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
  register: function(prefix, render) {
    handlers[prefix] = render;
  },
  lookup: function(key) {
    for(var prefix in handlers) {
      var re = new RegExp("^" + prefix);
      if(key.match(re)) {
        var opts = handlers[prefix](key);
        if(opts) {
          var board = obf.parse(opts.json);
          board.set('rendered', (new Date()).getTime());
          if(opts.handler) {
            board.set('button_handler', opts.handler);
          }
          return board;
        }
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
      console.log("adding", button && button.label, row, col);
      button.id = button.id || "btn_" + (++shell.id_index);
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
      if(row >= 0 && col >= 0 && row < shell.grid.rows && col < shell.grid.columns) {
        if(!shell.grid.order[row][col]) {
          shell.grid.order[row][col] = button.id;
        }
      }
    };
    return shell;
  }
}).create();

evaluation.register();

obf.register("emergency", function(key) {

});
window.obf = obf;

export default obf;
