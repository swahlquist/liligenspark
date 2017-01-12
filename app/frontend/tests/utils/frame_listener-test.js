import { describe, it, expect, beforeEach, afterEach, waitsFor, runs, stub } from 'frontend/tests/helpers/jasmine';
import { db_wait } from 'frontend/tests/helpers/ember_helper';
import capabilities from '../../utils/capabilities';
import app_state from '../../utils/app_state';
import frame_listener from '../../utils/frame_listener';
import Ember from 'ember';
import CoughDrop from '../../app';

describe("frame_listener", function() {
  var frame = null;
  var overlay = null;
  beforeEach(function() {
    frame = document.createElement('div');
    frame.id = 'integration_frame';
    document.body.appendChild(frame);
    overlay = document.createElement('div');
    overlay.id = 'integration_overlay';
    document.body.appendChild(overlay);
    overlay.style.left = '100px';
    overlay.style.top = '100px';
    overlay.style.width = '100px';
    overlay.style.height = '100px';
    overlay.style.position = 'absolute';
  });
  afterEach(function() {
    if(frame && frame.parentNode) {
      frame.parentNode.removeChild(frame);
    }
    if(overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    frame_listener.raw_listeners = {};
    frame_listener.set('targets', []);
  });

  describe('handle_action', function() {
    it('should trigger the correct method', function() {
      var method = null;
      var data = null;
      stub(frame_listener, 'listen', function(d) { method = 'listen'; data = d; });
      stub(frame_listener, 'stop_listening', function(d) { method = 'stop_listening'; data = d; });
      stub(frame_listener, 'status', function(d) { method = 'status'; data = d; });
      stub(frame_listener, 'add_text', function(d) { method = 'add_text'; data = d; });
      stub(frame_listener, 'update_manifest', function(d) { method = 'update_manifest'; data = d; });
      stub(frame_listener, 'retrieve_object', function(d) { method = 'retrieve_object'; data = d; });
      stub(frame_listener, 'add_target', function(d) { method = 'add_target'; data = d; });
      stub(frame_listener, 'clear_target', function(d) { method = 'clear_target'; data = d; });
      stub(frame_listener, 'clear_targets', function(d) { method = 'clear_targets'; data = d; });

      frame_listener.handle_action({action: 'listen', key: 'listen'});
      expect(method).toEqual('listen');
      expect(data.key).toEqual('listen');

      frame_listener.handle_action({action: 'stop_listening', key: 'key'});
      expect(method).toEqual('stop_listening');
      expect(data.key).toEqual('key');

      frame_listener.handle_action({action: 'status', key: 'abc'});
      expect(method).toEqual('status');
      expect(data.key).toEqual('abc');

      frame_listener.handle_action({action: 'add_text', key: 'hat'});
      expect(method).toEqual('add_text');
      expect(data.key).toEqual('hat');

      frame_listener.handle_action({action: 'update_manifest', key: 'cat'});
      expect(method).toEqual('update_manifest');
      expect(data.key).toEqual('cat');

      frame_listener.handle_action({action: 'retrieve_object', key: 'sat'});
      expect(method).toEqual('retrieve_object');
      expect(data.key).toEqual('sat');

      frame_listener.handle_action({action: 'add_target', key: 'rat'});
      expect(method).toEqual('add_target');
      expect(data.key).toEqual('rat');

      frame_listener.handle_action({action: 'clear_target', key: 'fat'});
      expect(method).toEqual('clear_target');
      expect(data.key).toEqual('fat');

      frame_listener.handle_action({action: 'clear_targets', key: 'splat'});
      expect(method).toEqual('clear_targets');
      expect(data.key).toEqual('splat');

      frame_listener.handle_action({action: 'bacon', respond: function(d) { method = 'bacon'; data = d; }});
      expect(method).toEqual('bacon');
      expect(data).toEqual({error: "unrecognized action, bacon"});
    });
  });

  describe('unload', function() {
    it('should stop listening and clear targets', function() {
      var stop_key = null;
      var clear_key = null;
      stub(frame_listener, 'stop_listening', function(k) {
        stop_key = k;
      });
      stub(frame_listener, 'clear_targets', function(k) {
        clear_key = k;
      });
      frame_listener.unload();
      waitsFor(function() { return stop_key && clear_key; });
      runs(function() {
        expect(stop_key).toEqual('all');
        expect(clear_key).toEqual('all');
      });
    });
  });

  describe('listen', function() {
    it('should add the listener', function() {
      var keys = Object.keys(frame_listener.raw_listeners);
      expect(keys.length).toEqual(0);

      frame_listener.handle_action({
        action: 'listen',
        session_id: 'asdf'
      });

      var keys = Object.keys(frame_listener.raw_listeners);
      expect(keys.length).toEqual(1);
    });

    it('should respond to the caller', function() {
      var id = null;
      frame_listener.listen({
        respond: function(data) {
          id = data.listen_id;
        },
        session_id: 'asdf'
      });
      waitsFor(function() { return id; });
      runs(function() {
        expect(frame_listener.raw_listeners['asdf' + id]).toNotEqual(undefined);
        expect(frame_listener.raw_listeners['asdf' + id].respond).toNotEqual(undefined);
        expect(frame_listener.raw_listeners['asdf' + id].session_id).toEqual('asdf');
      });
    });
  });

  describe('stop_listening', function() {
    it('should remove all listeners when specified', function() {
      frame_listener.raw_listeners = {a: 1, b: 2};
      frame_listener.stop_listening('all');
      expect(frame_listener.raw_listeners).toEqual({});
    });

    it('should remove all session listeners when specified', function() {
      frame_listener.raw_listeners = {a: 1, asdfa: 1};
      frame_listener.handle_action({action: 'stop_listening', session_id: 'asdf', listen_id: 'all'});
      expect(frame_listener.raw_listeners).toEqual({a: 1});
    });

    it('should remove the specified listener', function() {
      frame_listener.raw_listeners = {a: 1, asdfa: 1, asdfb: 1};
      frame_listener.handle_action({action: 'stop_listening', session_id: 'asdf', listen_id: 'b'});
      expect(frame_listener.raw_listeners).toEqual({a: 1, asdfa: 1});
    });

    it('should respond', function() {
      var data = null;
      frame_listener.raw_listeners = {a: 1, asdfa: 1, asdfb: 1};
      frame_listener.handle_action({action: 'stop_listening', session_id: 'asdf', listen_id: 'b', respond: function(d) { data = d; }});
      waitsFor(function() { return data; });
      runs(function() {
        expect(frame_listener.raw_listeners).toEqual({a: 1, asdfa: 1});
        expect(data).toEqual({cleared: true});
      });
    });
  });

  describe('raw_event', function() {
    it('should not trigger any if overlay not found', function() {
      var e = document.getElementById('integration_overlay');
      e.parentNode.removeChild(e);

      var a = null;
      var b = null;
      var t = null;
      frame_listener.raw_listeners = {
        asdfa: {
          respond: function(d) { a = d; },
          session_id: 'asdf'
        },
        asdfb: {
          respond: function(d) { b = d; },
          session_id: 'asdf'
        },
        qwert: {
          respond: function(d) { t = d; },
          session_id: 'qwer'
        }
      };
      frame_listener.raw_event({ session_id: 'asdf', type: 'click', aac_type: 'select', clientX: 100, clientY: 100 });
      expect(a).toEqual(null);
      expect(b).toEqual(null);
      expect(t).toEqual(null);
    });

    it('should trigger the event for all matching listeners', function() {
      var a = null;
      var b = null;
      var t = null;
      frame_listener.raw_listeners = {
        asdfa: {
          respond: function(d) { a = d; },
          session_id: 'asdf'
        },
        asdfb: {
          respond: function(d) { b = d; },
          session_id: 'asdf'
        },
        qwert: {
          respond: function(d) { t = d; },
          session_id: 'qwer'
        }
      };
      frame_listener.raw_event({ session_id: 'asdf', type: 'click', aac_type: 'select', clientX: 100, clientY: 100 });
      expect(a).toNotEqual(null);
      expect(a).toEqual({aac_type: 'select', type: 'click', x_percent: 0, y_percent: 0});
      expect(b).toNotEqual(null);
      expect(b).toEqual({aac_type: 'select', type: 'click', x_percent: 0, y_percent: 0});
      expect(t).toEqual(null);
    });

    it('should not trigger the event for non-matching listeners', function() {
      var a = null;
      var b = null;
      var t = null;
      frame_listener.raw_listeners = {
        asdfa: {
          respond: function(d) { a = d; },
          session_id: 'asdf'
        },
        asdfb: {
          respond: function(d) { b = d; },
          session_id: 'asdf'
        },
        qwert: {
          respond: function(d) { t = d; },
          session_id: 'qwer'
        }
      };
      frame.setAttribute('data-session_id', 'qwer');
      frame_listener.raw_event({ type: 'click', aac_type: 'select', clientX: 150, clientY: 125 });
      expect(a).toEqual(null);
      expect(b).toEqual(null);
      expect(t).toNotEqual(null);
      expect(t).toEqual({aac_type: 'select', type: 'click', x_percent: 0.5, y_percent: 0.25});
    });
  });

  describe('status', function() {
    it('should return ready status', function() {
      var data = null;
      frame_listener.status({respond: function(d) { data = d; }});
      expect(data).toEqual({status: 'ready', session_id: undefined, user_token: undefined});
    });

    it('should return the user token if specified', function() {
      var data = null;
      frame.setAttribute('data-user_token', 'token');
      frame_listener.handle_action({action: 'status', session_id: 'asdf', respond: function(d) { data = d; }});
      expect(data).toEqual({status: 'ready', session_id: 'asdf', user_token: 'token'});
    });
  });

  describe('add_text', function() {
    it('should trigger a button activation if specified', function() {
      var button = null;
      stub(app_state, 'activate_button', function(a, b) {
        button = b;
      });
      app_state.set('currentBoardState', {id: '1_1', key: 'hat/cat'});
      frame_listener.handle_action({action: 'add_text', text: 'hats', image_url: 'http://www.example.com/pic.png'});
      expect(button).toNotEqual(null);
      expect(button).toEqual({
        label: 'hats',
        vocalization: 'hats',
        image: 'http://www.example.com/pic.png',
        button_id: null,
        board: {id: '1_1', key: 'hat/cat'},
        type: 'speak'
      });
    });

    it('should return a response', function() {
      var button = null;
      var data = null;
      stub(app_state, 'activate_button', function(a, b) {
        button = b;
      });
      app_state.set('currentBoardState', {id: '1_1', key: 'hat/cat'});
      frame_listener.handle_action({action: 'add_text', text: 'hats', image_url: 'http://www.example.com/pic.png', respond: function(d) { data = d; }});
      expect(button).toNotEqual(null);
      expect(data).toEqual({added: true});
    });
  });

  describe('update_manifest', function() {
    it('should respond with not implemented', function() {
      var data = null;
      frame_listener.handle_action({action: 'update_manifest', respond: function(d) { data = d; }});
      expect(data).toEqual({error: 'not implemented'});
    });
  });

  describe('retrieve_object', function() {
    it('should respond with not implemented', function() {
      var data = null;
      frame_listener.handle_action({action: 'update_manifest', respond: function(d) { data = d; }});
      expect(data).toEqual({error: 'not implemented'});
    });
  });

  describe('trigger_target', function() {
    it('should respond to the matching target, matching by dom element', function() {
      var a = null, b = null;
      var d = {};
      frame_listener.set('targets', [
        {dom: d, session_id: 'asdf', id: '123', respond: function(d) { a = d; }},
        {dom: null, session_id: 'qwer', id: '234', respond: function(d) { b = d; }}
      ]);
      frame_listener.trigger_target(d);
      expect(a).toEqual({type: 'select', id: '123'});
      expect(b).toEqual(null);
    });

    it('should respond to the matching target, matching by session and id', function() {
      var a = null, b = null, c = null;
      var d = {};
      frame_listener.set('targets', [
        {dom: d, session_id: 'asdf', id: '123', respond: function(d) { a = d; }},
        {dom: null, session_id: 'qwer', id: '345', respond: function(d) { b = d; }},
        {dom: null, session_id: 'qwer', id: '234', respond: function(d) { c = d; }}
      ]);
      frame_listener.trigger_target({session_id: 'qwer', id: '234'});
      expect(a).toEqual(null);
      expect(b).toEqual(null);
      expect(c).toEqual({type: 'select', id: '234'});
    });
  });

//   add_target: function(data) {
//     var targets = this.get('targets') || [];
//     this.clear_target({session_id: data.session_id, id: data.target.id});
//     var div = document.createElement('div');
//     div.id = "target_" + data.session_id + "_" + data.target.id;
//     div.classList.add('integration_target');
//     var overlay = document.getElementById('integration_overlay');
//     if(overlay) {
//       var rect = overlay.getBoundingClientRect();
//       div.style.width = (data.target.width_percent * rect.width) + "px";
//       div.style.height = (data.target.height_percent * rect.height) + "px";
//       div.style.left = (data.target.left_percent * rect.width) + "px";
//       div.style.top = (data.target.top_percent * rect.height) + "px";
//       overlay.appendChild(div);
//       targets.push({id: data.target.id, session_id: data.session_id, target: data.target, dom: div, respond: data.respond});
//       this.set('targets', targets);
//       data.respond({id: data.target.id});
//       if(scanner.scanning) {
//         scanner.reset();
//       }
//     }
//   },
  describe('add_target', function() {
    it('should create a target element and add it to the DOM', function() {
    });

    it('should reset scanning', function() {
    });

    it('should add the target to the tracked list', function() {
    });

    it('should respond with the target id', function() {
    });
  });

//   trigger_target_event: function(dom, type, aac_type, session_id) {
//     var rect = dom.getBoundingClientRect();
//     var overlay = document.getElementById('integration_overlay');
//     if(overlay) {
//       session_id = session_id || document.getElementById('integration_frame').getAttribute('data-session_id');
//       if(session_id) {
//         frame_listener.raw_event({
//           session_id: session_id,
//           type: type,
//           aac_type: aac_type,
//           clientX: rect.left + (rect.width / 2),
//           clientY: rect.top + (rect.height / 2)
//         });
//       }
//     }
//   },
  describe('trigger_target_event', function() {
    it('should call raw_event for any matching sessions', function() {
    });
  });

//   size_targets: function() {
//     var overlay = document.getElementById('integration_overlay');
//     if(overlay) {
//       var rect = overlay.getBoundingClientRect();
//       (this.get('targets') || []).forEach(function(t) {
//         if(t && t.dom && t.target) {
//           t.dom.style.width = (t.target.width_percent * rect.width) + "px";
//           t.dom.style.height = (t.target.height_percent * rect.height) + "px";
//           t.dom.style.left = (t.target.left_percent * rect.width) + "px";
//           t.dom.style.top = (t.target.top_percent * rect.height) + "px";
//         }
//       });
//     }
//   }.observes('app_state.speak_mode'),
  describe('size_targets', function() {
    it('should resize visible targets based on window size', function() {
    });
  });

//   clear_target: function(data) {
//     var targets = this.get('targets') || [];
//     targets = targets.filter(function(t) { return t.session_id != data.session_id || t.id != data.id; });
//     this.set('targets', targets);
//     if(data.respond) {
//       data.respond({id: data.id});
//     }
//   },
  describe('clear_target', function() {
    it('should clear the specified target, if any', function() {
    });

    it('should remove the target from the DOM', function() {
    });

    it('should respond with the target id', function() {
    });
  });

//   clear_targets: function(data) {
//     var targets = this.get('targets') || [];
//     if(data == 'all') {
//       targets = [];
//     } else {
//       targets = targets.filter(function(t) { return t.session_id != data.session_id; });
//     }
//     this.set('targets', targets);
//     data.respond({cleared: true});
//   },
  describe('clear_targets', function() {
    it('should clear all targets if specified', function() {
    });

    it('should remove targets by ids if specified', function() {
    });

    it('should remove cleared targets from the DOM', function() {
    });

    it('should respond on success', function() {
    });
  });

//   visible: function() {
//     return !!document.getElementById('integration_overlay');
//   },
  describe('visible', function() {
    it('should return the correct value', function() {
    });
  });

//   active_targets: function() {
//     var session_id = document.getElementById('integration_frame').getAttribute('data-session_id');
//     return (this.get('targets') || []).filter(function(t) { return t.session_id == session_id; });
//   }
  describe('active_targets', function() {
    it('should return a list of targets for the current session', function() {
    });
  });

// window.addEventListener('resize', function() {
//   Ember.run.debounce(frame_listener, frame_listener.size_targets, 100);
// });
  describe('window resizing', function() {
    it('should call size_targets on window resize', function() {
    });
  });

// window.addEventListener('message', function(event) {
//   if(event.data && event.data.aac_shim) {
//     var $elem = Ember.$("#integration_frame");
//     event.data.respond = function(obj) {
//       obj.aac_shim = true;
//       obj.callback_id = event.data.callback_id;
//       event.source.postMessage(obj, '*');
//     };
//     if(!event.data.session_id) {
//       event.data.respond({error: 'session_id required, but not sent'});
//       return;
//     } else if(!$elem[0]) {
//       event.data.respond({error: 'message came from unknown source'});
//       return;
//     } else if(event.source != $elem[0].contentWindow) {
//       event.data.respond({error: 'message came from wrong window'});
//       return;
//     }
//     if(!$elem.attr('data-session_id')) {
//       $elem.attr('data-session_id', event.data.session_id);
//     }
//     frame_listener.handle_action(event.data);
//   }
// });
  describe('postMessage handling', function() {
    it('should ignore if not an aac_shim event', function() {
    });

    it('should respond with an error if no session_id sent', function() {
    });

    it('should respond with an error if no frame loaded', function() {
    });

    it('should respond with an error if not from the frame', function() {
    });

    it('should call handle_action with the correct data', function() {
    });
  });
});
