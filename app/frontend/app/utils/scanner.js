import Ember from 'ember';
import editManager from './edit_manager';
import modal from './modal';
import capabilities from './capabilities';
import app_state from './app_state';
import i18n from './i18n';
import speecher from './speecher';
import buttonTracker from './raw_events';

var scanner = Ember.Object.extend({
  setup: function(controller) {
    this.controller = controller;
  },
  start: function(options) {
    if(Ember.$("header #speak").length === 0) {
      console.debug("scanning currently only works in speak mode...");
      scanner.stop();
      return;
    }
    var rows = [];
    options = options || this.last_options || {};
    this.last_options = options;
    options.scan_mode = options.scan_mode || "row";
    options.interval = options.interval || 1000;

    if(modal.is_open() && !modal.is_open('highlight')) {
      return;
    } else {
      var row = {
        children: [],
        dom: Ember.$("header"),
        label: i18n.t('header', "Header")
      };
      Ember.$("header #speak").find("button:visible,#button_list,a.btn").each(function() {
        var id_labels = {
          'home_button': i18n.t('home', "Home"),
          'back_button': i18n.t('back', "Back"),
          'button_list': i18n.t('speak', "Speak"),
          'speak_options': i18n.t('options', "Speak Options"),
          'backspace_button': i18n.t('backspace', "Backspace"),
          'clear_button': i18n.t('clear', "Clear")
        };
        var $elem = Ember.$(this);
        if($elem.attr('id') != 'speak_options') {
          var label = id_labels[$elem.attr('id')] || "";
          row.children.push({
            dom: $elem,
            label: label
          });
        }
      });

      var menu = {
        dom: Ember.$("#identity a.btn"),
        label: i18n.t('menu', "Menu"),
        children: []
      };
      Ember.$("#identity .dropdown-menu a").each(function() {
        var $option = Ember.$(this);
        menu.children.push({
          dom: $option,
          label: $option.text()
        });
      });
      row.children.push(menu);

      // TODO: figure out sidebar, when teaser is visible and also when the
      // whole sidebar is visible, including toggling between the two
  //     if(Ember.$("#sidebar_tease:visible").length) {
  //       row.children.push({
  //         dom: Ember.$("#sidebar_tease")
  //       });
  //     }
      rows.push(row);
      if(Ember.$("#word_suggestions").length) {
        var row = {
          children: [],
          dom: Ember.$("#word_suggestions"),
          label: i18n.t('suggestions', "Suggestions"),
          reload_children: function() {
            var res = [];
            Ember.$("#word_suggestions").find(".suggestion").each(function() {
              var $elem = Ember.$(this);
              res.push({
                dom: $elem,
                label: $elem.text()
              });
            });
            return res;
          }
        };
        row.children = row.reload_children();

        rows.push(row);
      }

      if(options.scan_mode == 'row' || options.scan_mode == 'button') {
        var grid = editManager.controller.get('model.grid');
        for(var idx = 0; idx < grid.rows; idx++) {
          row = {
            children: [],
            dom: Ember.$(),
            label: i18n.t('row_n', "Row %{n}", {n: (idx + 1)})
          };
          for(var jdx = 0; jdx < grid.columns; jdx++) {
            var $button = Ember.$(".button[data-id='" + grid.order[idx][jdx] + "']:not(.hidden_button)");
            if($button.length) {
              var button = editManager.find_button(grid.order[idx][jdx]);
              var label = (button && (button.get('vocalization') || button.get('label'))) || "";
              row.dom = row.dom.add($button);
              row.children.push({
                dom: $button,
                label: label,
                sound: button && button.get('sound')
              });
            }
          }
          if(row.children.length > 0) {
            rows.push(row);
          }
        }
      } else if(options.scan_mode == 'column') {
        var grid = editManager.controller.get('model.grid');
        for(var idx = 0; idx < grid.columns; idx++) {
          var column = {
            children: [],
            dom: Ember.$(),
            label: i18n.t('column_n', "Column %{n}", {n: (idx + 1)})
          };
          for(var jdx = 0; jdx < grid.rows; jdx++) {
            var $button = Ember.$(".button[data-id='" + grid.order[jdx][idx] + "']:not(.hidden_button)");
            if($button.length) {
              var button = editManager.find_button(grid.order[idx][jdx]);
              var label = (button && (button.get('vocalization') || button.get('label'))) || "";
              column.dom = column.dom.add($button);
              column.children.push({
                dom: $button,
                label: label,
                sound: button && button.get('sound')
              });
            }
          }
          if(column.children.length > 0) {
            rows.push(column);
          }
        }
      } else if(options.scan_mode == 'region') {
        var rows_per_chunk = options.rows_per_chunk;
        var columns_per_chunk = options.columns_per_chunk;
        var sub_scan = options.sub_scan_mode || 'horizontal';
        var grid = editManager.controller.get('model.grid');
        var vertical_chunks = options.vertical_chunks || Math.ceil(grid.rows / (rows_per_chunk || 3));
        var horizontal_chunks = options.horizontal_chunks || Math.ceil(grid.columns / (columns_per_chunk || 3));
        if(!rows_per_chunk || (rows_per_chunk < grid.rows / vertical_chunks)) {
          rows_per_chunk = Math.max(Math.floor(grid.rows / vertical_chunks), 1);
        }
        var leftover_rows = grid.rows - (rows_per_chunk * vertical_chunks);
        if(!columns_per_chunk || (columns_per_chunk < grid.columns / horizontal_chunks)) {
          columns_per_chunk = Math.max(Math.floor(grid.columns / horizontal_chunks), 1);
        }
        var leftover_columns = grid.columns - (columns_per_chunk * horizontal_chunks);
        if(sub_scan == 'vertical' || true) {
          for(var idx = 0; idx < horizontal_chunks; idx++) {
            for(var jdx = 0; jdx < vertical_chunks; jdx++) {
              var chunk = {
                children: [],
                dom: Ember.$(),
                label: i18n.t('region_n', "Region %{n}", {n: ((idx * vertical_chunks) + jdx + 1)})
              };
              var n_columns = columns_per_chunk;
              if(idx == horizontal_chunks - 1) { n_columns = n_columns + leftover_columns; }
              var n_rows = rows_per_chunk;
              if(jdx == vertical_chunks - 1) { n_rows = n_rows + leftover_rows; }
              for(var kdx = 0; kdx < n_columns; kdx++) {
                for(var ldx = 0; ldx < n_rows; ldx++) {
                  var r = grid.order[(jdx * rows_per_chunk) + ldx];
                  if(r) {
                    var id = r[(idx * columns_per_chunk) + kdx];
                    if(id) {
                      var $button = Ember.$(".button[data-id='" + id + "']:not(.hidden_button)");
                      if($button.length) {
                        var button = editManager.find_button(id);
                        var label = (button && (button.get('vocalization') || button.get('label'))) || "";
                        chunk.dom = chunk.dom.add($button);
                        chunk.children.push({
                          dom: $button,
                          label: label,
                          sound: button && button.get('sound')
                        });
                      }
                    }
                  }
                }
              }
              if(chunk.children.length > 0) {
                rows.push(chunk);
              }
            }
          }
        } else {
          for(var idx = 0; idx < vertical_chunks; idx++) {
            for(var jdx = 0; jdx < horizontal_chunks; jdx++) {
              var chunk = {
                children: [],
                dom: Ember.$(),
                label: i18n.t('region_n', "Region %{n}", {n: ((idx * horizontal_chunks) + jdx + 1)})
              };
              for(var kdx = 0; kdx < rows_per_chunk; kdx++) {
                for(var ldx = 0; ldx < columns_per_chunk; ldx++) {
                  var r = grid.order[(idx * rows_per_chunk) + kdx];
                  if(r) {
                    var id = r[(jdx * columns_per_chunk) + ldx];
                    if(id) {
                      var $button = Ember.$(".button[data-id='" + id + "']:not(.hidden_button)");
                      if($button.length) {
                        var button = editManager.find_button(id);
                        var label = (button && (button.get('vocalization') || button.get('label'))) || "";
                        chunk.dom = chunk.dom.add($button);
                        chunk.children.push({
                          dom: $button,
                          label: label,
                          sound: button && button.get('sound')
                        });
                      }
                    }
                  }
                }
              }
              if(chunk.children.length > 0) {
                rows.push(chunk);
              }
            }
          }
        }
      }
      if(options.scan_mode == 'button') {
        var new_rows = [];
        rows.forEach(function(row) {
          if(row.children) {
            row.children.forEach(function(elem) {
              new_rows.push(elem);
            });
          } else {
            new_rows.push(row);
          }
        });
        rows = new_rows;
      }
    }
    this.scanning = true;
    this.scan_elements(rows, options);
  },
  reset: function() {
    Ember.run.cancel(scanner.interval);
    this.start();
  },
  stop: function()  {
    Ember.run.cancel(scanner.interval);
    this.scanning = false;
    modal.close_highlight();
  },
  scan_elements: function(elements, options) {
    this.elements = elements;
    this.options = options;
    this.element_index = 0;
    this.next_element();
  },
  pick: function() {
    var elem = scanner.current_element;
    if(!modal.highlight_controller || !elem) { return; }
    if(!elem.higher_level && elem.children && elem.children.length == 1) {
      elem = elem.children[0];
    }

    buttonTracker.track_selection({
      event_type: 'click',
      selection_type: 'scanner'
    });

    if(elem.dom && elem.dom.classList.contains('integration_target')) {
      var rect = elem.dom.getBoundingClientRect();
      var overlay = document.getElementById('integration_overlay');
      if(overlay) {
        var overlay_rect = overlay.getBoundingClientRect();
        var session_id = document.getElementById('integration_frame').getAttribute('data-session_id');
        if(session_id) {
          frame_listener.raw_event({
            session_id: session_id,
            type: 'scanselect',
            aac_type: 'select',
            x_percent: ((rect.left + (rect.width / 2)) - overlay_rect.left) / overlay_rect.width,
            y_percent: ((rect.top + (rect.height / 2)) - overlay_rect.top) / overlay_rect.height
          });
        }
      }
    }

    if(elem.dom && elem.dom.hasClass('btn') && elem.dom.closest("#identity").length > 0) {
      var e = Ember.$.Event( "click" );
      e.pass_through = true;
      e.switch_activated = true;
      Ember.$(elem.dom).trigger(e);
      setTimeout(function() {
        Ember.$("#home_button").focus().select();
      }, 100);
    }

    if(elem.higher_level) {
      scanner.elements = elem.higher_level;
      scanner.element_index = elem.higher_level_index;
      Ember.run.cancel(scanner.interval);
      scanner.interval = Ember.run.later(function() {
        scanner.next_element();
      });
    } else if(elem.children) {
      scanner.load_children(elem, scanner.elements, scanner.element_index);
    } else if(elem.dom) {
      if(elem.dom.hasClass('button') && elem.dom.attr('data-id')) {
        var id = elem.dom.attr('data-id');
        var button = editManager.find_button(id);
        var app = app_state.controller;
        var board = app.get('board.model');
        app.activateButton(button, {image: button.get('image'), sound: button.get('sound'), board: board});
      } else if(elem.dom.hasClass('button_list')) {
        elem.dom.select();
      } else {
        var e = Ember.$.Event( "click" );
        e.pass_through = true;
        Ember.$(elem.dom).trigger(e);
      }
      Ember.run.later(function() {
        scanner.reset();
      });
    }
  },
  load_children: function(elem, elements, index) {
    var parent = Ember.$.extend({higher_level: elements, higher_level_index: index}, elem);
    if(elem.reload_children) {
      elem.children = elem.reload_children();
    }
    scanner.elements = elem.children.concat([parent]);
    scanner.element_index = 0;
    Ember.run.cancel(scanner.interval);
    scanner.interval = Ember.run.later(function() {
      scanner.next_element();
    });
  },
  next: function() {
    Ember.run.cancel(scanner.interval);
    scanner.element_index = scanner.element_index + 1;
    if(scanner.element_index >= scanner.elements.length) {
      scanner.element_index = 0;
    }
    scanner.next_element();
  },
  next_element: function() {
    var elem = this.elements[this.element_index];
    if(!elem) {
      elem = elem || this.elements[0];
      this.element_index = 0;
    }
    if(!document.body.contains(elem.dom[0])) {
      var last = this.elements[this.elements.length - 1];
      if(last && last.higher_level && last.reload_children) {
        scanner.load_children(last.higher_level[last.higher_level_index], last.higher_level, last.higher_level_index);
        return;
      }
    }
    scanner.current_element = elem;
    var options = scanner.options;
    options.prevent_close = true;
    options.overlay = false;
    options.select_anywhere = true;
    if(scanner.options && scanner.options.focus_overlay) {
      options.overlay = true;
      options.clear_overlay = false;
    }

    if(this.options && this.options.audio) {
      if(elem && elem.sound) {
        speecher.speak_audio(elem.sound, 'text', false, {alternate_voice: true, interrupt: false});
      } else if(elem && elem.label) {
        var clean_label = (elem.label || "").replace(/^[\+\:]/, '');
        speecher.speak_text(clean_label, false, {alternate_voice: true, interrupt: false});
      }
    }
    if(capabilities.mobile && capabilities.installed_app && app_state.get('speak_mode') && Ember.$("#hidden_input:focus").length === 0) {
      modal.warning(i18n.t('tap_first', "Your switch may not be completely enabled. Tap somewhere on the screen to finish enabling it."), true);
    }
    if(elem.dom.classList.contains('integration_target')) {
      var rect = elem.dom.getBoundingClientRect();
      var overlay = document.getElementById('integration_overlay');
      if(overlay) {
        var overlay_rect = overlay.getBoundingClientRect();
        var session_id = document.getElementById('integration_frame').getAttribute('data-session_id');
        if(session_id) {
          frame_listener.raw_event({
            session_id: session_id,
            type: 'scanover',
            aac_type: 'over',
            x_percent: ((rect.left + (rect.width / 2)) - overlay_rect.left) / overlay_rect.width,
            y_percent: ((rect.top + (rect.height / 2)) - overlay_rect.top) / overlay_rect.height
          });
        }
      }
    }
    modal.highlight(elem.dom, options).then(function() {
      scanner.pick();
    }, function() { });
    scanner.interval = Ember.run.later(function() {
      if(scanner.current_element == elem) {
        scanner.next();
      }
    }, this.options.interval);
  }
}).create();

export default scanner;
