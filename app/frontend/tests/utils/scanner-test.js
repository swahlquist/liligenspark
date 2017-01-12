import { describe, it, expect, beforeEach, afterEach, waitsFor, runs, stub } from 'frontend/tests/helpers/jasmine';
import { db_wait, fakeAudio } from 'frontend/tests/helpers/ember_helper';
import scanner from '../../utils/scanner';
import modal from '../../utils/modal';
import buttonTracker from '../../utils/raw_events';
import Ember from 'ember';

describe('scanner', function() {
  afterEach(function() {
    scanner.stop();
  });

  describe("setup", function() {
    it("should set the controller", function() {
      db_wait(function() {
        expect(scanner.controller).toEqual(undefined);
        var con = {a: 1};
        scanner.setup(con);
        expect(scanner.controller).toEqual(con);
      });
    });
  });

//   start: function(options) {
//     if(Ember.$("header #speak").length === 0) {
//       console.debug("scanning currently only works in speak mode...");
//       scanner.stop();
//       return;
//     }
//     var rows = [];
//     options = options || this.last_options || {};
//     this.last_options = options;
//     options.scan_mode = options.scan_mode || "row";
//     options.interval = options.interval || 1000;
//
//     if(modal.is_open() && !modal.is_open('highlight')) {
//       return;
//     } else {
//       var row = {
//         children: [],
//         dom: Ember.$("header"),
//         label: i18n.t('header', "Header")
//       };
//       Ember.$("header #speak").find("button:visible,#button_list,a.btn").each(function() {
//         var id_labels = {
//           'home_button': i18n.t('home', "Home"),
//           'back_button': i18n.t('back', "Back"),
//           'button_list': i18n.t('speak', "Speak"),
//           'speak_options': i18n.t('options', "Speak Options"),
//           'backspace_button': i18n.t('backspace', "Backspace"),
//           'clear_button': i18n.t('clear', "Clear")
//         };
//         var $elem = Ember.$(this);
//         if($elem.attr('id') != 'speak_options') {
//           var label = id_labels[$elem.attr('id')] || "";
//           row.children.push({
//             dom: $elem,
//             label: label
//           });
//         }
//       });
//
//       var menu = {
//         dom: Ember.$("#identity a.btn"),
//         label: i18n.t('menu', "Menu"),
//         children: []
//       };
//       Ember.$("#identity .dropdown-menu a").each(function() {
//         var $option = Ember.$(this);
//         menu.children.push({
//           dom: $option,
//           label: $option.text()
//         });
//       });
//       row.children.push(menu);
//
//       // TODO: figure out sidebar, when teaser is visible and also when the
//       // whole sidebar is visible, including toggling between the two
//   //     if(Ember.$("#sidebar_tease:visible").length) {
//   //       row.children.push({
//   //         dom: Ember.$("#sidebar_tease")
//   //       });
//   //     }
//       rows.push(row);
//       if(options.scan_mode == 'row' || options.scan_mode == 'button') {
//         var grid = editManager.controller.get('model.grid');
//         for(var idx = 0; idx < grid.rows; idx++) {
//           row = {
//             children: [],
//             dom: Ember.$(),
//             label: i18n.t('row_n', "Row %{n}", {n: (idx + 1)})
//           };
//           for(var jdx = 0; jdx < grid.columns; jdx++) {
//             var $button = Ember.$(".button[data-id='" + grid.order[idx][jdx] + "']:not(.hidden_button)");
//             if($button.length) {
//               var button = editManager.find_button(grid.order[idx][jdx]);
//               var label = (button && (button.get('vocalization') || button.get('label'))) || "";
//               row.dom = row.dom.add($button);
//               row.children.push({
//                 dom: $button,
//                 label: label,
//                 sound: button && button.get('sound')
//               });
//             }
//           }
//           if(row.children.length > 0) {
//             rows.push(row);
//           }
//         }
//       } else if(options.scan_mode == 'column') {
//         var grid = editManager.controller.get('model.grid');
//         for(var idx = 0; idx < grid.columns; idx++) {
//           var column = {
//             children: [],
//             dom: Ember.$(),
//             label: i18n.t('column_n', "Column %{n}", {n: (idx + 1)})
//           };
//           for(var jdx = 0; jdx < grid.rows; jdx++) {
//             var $button = Ember.$(".button[data-id='" + grid.order[jdx][idx] + "']:not(.hidden_button)");
//             if($button.length) {
//               var button = editManager.find_button(grid.order[idx][jdx]);
//               var label = (button && (button.get('vocalization') || button.get('label'))) || "";
//               column.dom = column.dom.add($button);
//               column.children.push({
//                 dom: $button,
//                 label: label,
//                 sound: button && button.get('sound')
//               });
//             }
//           }
//           if(column.children.length > 0) {
//             rows.push(column);
//           }
//         }
//       } else if(options.scan_mode == 'region') {
//         var rows_per_chunk = options.rows_per_chunk || 3;
//         var columns_per_chunk = options.columns_per_chunk || 3;
//         var sub_scan = options.sub_scan_mode || 'horizontal';
//         var grid = editManager.controller.get('model.grid');
//         var vertical_chunks = options.vertical_chunks || Math.ceil(grid.rows / rows_per_chunk);
//         var horizontal_chunks = options.horizontal_chunks || Math.ceil(grid.columns / columns_per_chunk);
//         if(rows_per_chunk < grid.rows / vertical_chunks) {
//           rows_per_chunk = Math.ceil(grid.rows / vertical_chunks);
//         }
//         if(columns_per_chunk < grid.columns / horizontal_chunks) {
//           columns_per_chunk = Math.ceil(grid.columns / horizontal_chunks);
//         }
//         if(sub_scan == 'vertical' || true) {
//           for(var idx = 0; idx < horizontal_chunks; idx++) {
//             for(var jdx = 0; jdx < vertical_chunks; jdx++) {
//               var chunk = {
//                 children: [],
//                 dom: Ember.$(),
//                 label: i18n.t('region_n', "Region %{n}", {n: ((idx * vertical_chunks) + jdx + 1)})
//               };
//               for(var kdx = 0; kdx < columns_per_chunk; kdx++) {
//                 for(var ldx = 0; ldx < rows_per_chunk; ldx++) {
//                   var r = grid.order[(jdx * rows_per_chunk) + ldx];
//                   if(r) {
//                     var id = r[(idx * columns_per_chunk) + kdx];
//                     if(id) {
//                       var $button = Ember.$(".button[data-id='" + id + "']:not(.hidden_button)");
//                       if($button.length) {
//                         var button = editManager.find_button(id);
//                         var label = (button && (button.get('vocalization') || button.get('label'))) || "";
//                         chunk.dom = chunk.dom.add($button);
//                         chunk.children.push({
//                           dom: $button,
//                           label: label,
//                           sound: button && button.get('sound')
//                         });
//                       }
//                     }
//                   }
//                 }
//               }
//               if(chunk.children.length > 0) {
//                 rows.push(chunk);
//               }
//             }
//           }
//         } else {
//           for(var idx = 0; idx < vertical_chunks; idx++) {
//             for(var jdx = 0; jdx < horizontal_chunks; jdx++) {
//               var chunk = {
//                 children: [],
//                 dom: Ember.$(),
//                 label: i18n.t('region_n', "Region %{n}", {n: ((idx * horizontal_chunks) + jdx + 1)})
//               };
//               for(var kdx = 0; kdx < rows_per_chunk; kdx++) {
//                 for(var ldx = 0; ldx < columns_per_chunk; ldx++) {
//                   var r = grid.order[(idx * rows_per_chunk) + kdx];
//                   if(r) {
//                     var id = r[(jdx * columns_per_chunk) + ldx];
//                     if(id) {
//                       var $button = Ember.$(".button[data-id='" + id + "']:not(.hidden_button)");
//                       if($button.length) {
//                         var button = editManager.find_button(id);
//                         var label = (button && (button.get('vocalization') || button.get('label'))) || "";
//                         chunk.dom = chunk.dom.add($button);
//                         chunk.children.push({
//                           dom: $button,
//                           label: label,
//                           sound: button && button.get('sound')
//                         });
//                       }
//                     }
//                   }
//                 }
//               }
//               if(chunk.children.length > 0) {
//                 rows.push(chunk);
//               }
//             }
//           }
//         }
//       }
//       if(options.scan_mode == 'button') {
//         var new_rows = [];
//         rows.forEach(function(row) {
//           if(row.children) {
//             row.children.forEach(function(elem) {
//               new_rows.push(elem);
//             });
//           } else {
//             new_rows.push(row);
//           }
//         });
//         rows = new_rows;
//       }
//     }
//     this.scanning = true;
//     this.scan_elements(rows, options);
//   },
  describe("start", function() {
    it("should have specs");
  });

  describe("reset", function() {
    it("should cancel any existing interval", function() {
      db_wait(function() {
        var interval = {a: 1};
        scanner.interval = interval;
        var passed_interval = null;
        stub(Ember.run, 'cancel', function(arg) {
          passed_interval = arg;
        });
        scanner.reset();
        waitsFor(function() { return passed_interval; });
        runs(function() {
          expect(passed_interval).toEqual(interval);
        });
      });
    });

    it("should call 'start'", function() {
      db_wait(function() {
        var called = false;
        stub(scanner, 'start', function() { called = true; });
        scanner.reset();
        waitsFor(function() { return called; });
        runs();
      });
    });
  });

  describe("stop", function() {
    it("should cancel any existing interval", function() {
      db_wait(function() {
        var interval = {a: 1};
        scanner.interval = interval;
        var passed_interval = null;
        stub(Ember.run, 'cancel', function(arg) {
          passed_interval = arg;
        });
        scanner.stop();
        waitsFor(function() { return passed_interval; });
        runs(function() {
          expect(passed_interval).toEqual(interval);
        });
      });
    });
    it("should set scanning to false", function() {
      db_wait(function() {
        scanner.scanning = true;
        scanner.stop();
        expect(scanner.scanning).toEqual(false);
      });
    });
    it("should close any existing highlight", function() {
      db_wait(function() {
        var called = false;
        stub(modal, 'close_highlight', function() { called = true; });
        scanner.stop();
        waitsFor(function() { return called; });
        runs();
      });
    });
  });

  describe("scan_elements", function() {
    it("should reset scanning options", function() {
      db_wait(function() {
        var a = {a: 1};
        var b = {b: 1};
        var opts = {asdf: true};
        stub(scanner, 'next_element', function() { });
        scanner.scan_elements([a, b], opts);
        expect(scanner.elements).toEqual([a, b]);
        expect(scanner.options).toEqual(opts);
        expect(scanner.element_index).toEqual(0);
      });
    });

    it("should call next_element", function() {
      db_wait(function() {
        var called = false;
        stub(scanner, 'next_element', function() { called = true; });
        scanner.scan_elements();
        waitsFor(function() { return called; });
        runs();
      });
    });
  });

  describe("pick", function() {
    it("should have specs");

    it("should call buttonTrack.track_selection", function() {
      scanner.current_element = {};
      scanner.current_element.dom = document.createElement('div');

      modal.highlight_controller = {};

      var called = false;
      stub(buttonTracker, 'track_selection', function(opts) {
        expect(opts).toEqual({
          event_type: 'click',
          selection_type: 'scanner'
        });
        called = true;
      });

      scanner.pick();
    });
  });

//   pick: function() {
//     var elem = scanner.current_element;
//     if(!modal.highlight_controller || !elem) { return; }
//     if(!elem.higher_level && elem.children && elem.children.length == 1) {
//       elem = elem.children[0];
//     }
//
//     buttonTracker.track_selection({
//       event_type: 'click',
//       selection_type: 'scanner'
//     });
//
//     if(elem.dom.hasClass('btn') && elem.dom.closest("#identity").length > 0) {
//       var e = Ember.$.Event( "click" );
//       e.pass_through = true;
//       e.switch_activated = true;
//       Ember.$(elem.dom).trigger(e);
//       setTimeout(function() {
//         Ember.$("#home_button").focus().select();
//       }, 100);
//     }
//
//     if(elem.higher_level) {
//       scanner.elements = elem.higher_level;
//       scanner.element_index = elem.higher_level_index;
//       Ember.run.cancel(scanner.interval);
//       scanner.interval = Ember.run.later(function() {
//         scanner.next_element();
//       });
//     } else if(elem.children) {
//       scanner.load_children(elem, scanner.elements, scanner.element_index);
//     } else {
//       if(elem.dom.hasClass('button') && elem.dom.attr('data-id')) {
//         var id = elem.dom.attr('data-id');
//         var button = editManager.find_button(id);
//         var app = app_state.controller;
//         var board = app.get('board.model');
//         app.activateButton(button, {image: button.get('image'), sound: button.get('sound'), board: board});
//       } else if(elem.dom.hasClass('button_list')) {
//         elem.dom.select();
//       } else {
//         var e = Ember.$.Event( "click" );
//         e.pass_through = true;
//         Ember.$(elem.dom).trigger(e);
//       }
//       Ember.run.later(function() {
//         scanner.reset();
//       });
//     }
//   },

  describe("next", function() {
    it("should cancel any existing interval", function() {
      db_wait(function() {
        var interval = {a: 1};
        scanner.elements = [{}, {}];
        scanner.interval = interval;
        var passed_interval = null;
        stub(Ember.run, 'cancel', function(arg) {
          passed_interval = arg;
        });
        stub(scanner, 'next_element', function() { });
        scanner.next();
        waitsFor(function() { return passed_interval; });
        runs(function() {
          expect(passed_interval).toEqual(interval);
        });
      });
    });

    it("should properly increment the element index", function() {
      db_wait(function() {
        scanner.elements = [{}, {}];
        scanner.element_index = 0;
        stub(scanner, 'next_element', function() { });
        scanner.next();
        expect(scanner.element_index).toEqual(1);
        scanner.next();
        expect(scanner.element_index).toEqual(0);
      });
    });
  });

//   next_element: function() {
//     var elem = this.elements[this.element_index];
//     scanner.current_element = elem;
//     var options = scanner.options;
//     options.prevent_close = true;
//     options.overlay = false;
//     options.select_anywhere = true;
//     if(scanner.options && scanner.options.whole_screen_button) {
//       options.overlay = true;
//       options.clear_overlay = true;
//     }
//     if(scanner.options && scanner.options.focus_overlay) {
//       options.overlay = true;
//       options.clear_overlay = false;
//     }
//
//     if(this.options && this.options.audio) {
//       if(elem && elem.sound) {
//         speecher.speak_audio(elem.sound, 'text', false, {interrupt: false});
//       } else if(elem && elem.label) {
//         speecher.speak_text(elem.label, false, {interrupt: false});
//       }
//     }
//     modal.highlight(elem.dom, options).then(function() {
//       scanner.pick();
//     }, function() { });
//     scanner.interval = Ember.run.later(function() {
//       if(scanner.current_element == elem) {
//         scanner.next();
//       }
//     }, this.options.interval);
//   }
  describe("next_element", function() {
    it("should have specs");
  });
});
