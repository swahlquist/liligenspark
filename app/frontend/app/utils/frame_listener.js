import Ember from 'ember';
import app_state from './app_state';
import scanner from './scanner';

var raw_listeners = {};
var frame_listener = Ember.Object.extend({
  handle_action: function(data) {
    data.respond = data.respond || function() { };
    if(data.action == 'listen') {
      this.listen(data);
    } else if(data.action == 'stop_listening') {
      this.stop_listening(data);
    } else if(data.action == 'status') {
      this.status(data);
    } else if(data.action == 'add_text') {
      this.add_text(data);
    } else if(data.action == 'update_manifest') {
      this.update_manifest(data);
    } else if(data.action == 'retrieve_object') {
      this.retrieve_object(data);
    } else if(data.action == 'add_target') {
      this.add_target(data);
    } else if(data.action == 'clear_target') {
      this.clear_target(data);
    } else if(data.action == 'clear_targets') {
      this.clear_targets(data);
    } else {
      data.respond({error: 'unrecognized action, ' + data.action});
    }
  },
  unload: function() {
    this.stop_listening('all');
    this.clear_targets('all');
  },
  listen: function(data) {
    var id = (new Date().getTime()) + "_" + Math.random();
    frame_listener.raw_listeners[data.session_id + id] = data;
    data.respond({listen_id: id});
  },
  stop_listening: function(data) {
    if(data == 'all') {
      for(var idx in frame_listener.raw_listeners) {
        if(frame_listener.raw_listeners[idx]) {
          delete frame_listener.raw_listeners[idx];
        }
      }
    } else if(data.listen_id == 'all') {
      for(var idx in frame_listener.raw_listeners) {
        if(frame_listener.raw_listeners[idx] && data.session_id && idx.indexOf(data.session_id) === 0) {
          delete frame_listener.raw_listeners[idx];
        }
      }
    } else {
      delete frame_listener.raw_listeners[data.session_id + data.listen_id];
    }
    if(data && data.respond) {
      data.respond({cleared: true});
    }
  },
  raw_event: function(event) {
    var overlay = document.getElementById('integration_overlay');
    var session_id = event.session_id;
    if(!session_id) {
      session_id = document.getElementById('integration_frame').getAttribute('data-session_id');
    }
    if(overlay) {
      var rect = overlay.getBoundingClientRect();
      for(var idx in frame_listener.raw_listeners) {
        if(frame_listener.raw_listeners[idx] && frame_listener.raw_listeners[idx].session_id == session_id && frame_listener.raw_listeners[idx].respond) {
          frame_listener.raw_listeners[idx].respond({
            type: event.type, // 'click', 'touch', 'gazedwell', 'scanselect', 'mousemove', 'gazelinger'
            aac_type: event.aac_type, // 'start', 'select', 'over'
            x_percent: (event.clientX - rect.left) / rect.width, // 0.0 - 1.0
            y_percent: (event.clientY - rect.top) / rect.height // 0.0 - 1.0
          });
        }
      }
    }
    // propagate to active listeners
  },
  status: function(data) {
    var session_id = data.session_id;
    var $elem = Ember.$("#integration_frame");
    data.respond({
      status: 'ready',
      session_id: session_id,
      user_token: $elem.attr('data-user_token')
    });
  },
  add_text: function(data) {
    var obj = {
      label: data.text,
      vocalization: data.text,
      image: data.image_url,
      button_id: null,
      board: {id: app_state.get('currentBoardState.id'),key:  app_state.get('currentBoardState.key')},
      type: 'speak'
    };

    app_state.activate_button({}, obj);

    data.respond({added: true});
  },
  update_manifest: function(data) {
    // { html_url: '', script_url: '', state: {key: 'values', only: 'folks'}, objects: [{url: '', type: 'image'}] }
    data.respond({error: 'not implemented'});
  },
  retrieve_object: function(data) {
    data.respond({error: 'not implemented'});
  },
  trigger_target: function(ref) {
    var target = (this.get('targets') || []).find(function(t) { return (t.dom && ref == t.dom) || (t.session_id == ref.session_id && t.id == ref.id); });
    if(target && target.respond) {
      target.respond({
        type: 'select',
        id: target.id
      });
    }
  },
  add_target: function(data) {
    var targets = this.get('targets') || [];
    this.clear_target({session_id: data.session_id, id: data.target.id});
    var div = document.createElement('div');
    div.id = "target_" + data.session_id + "_" + data.target.id;
    div.classList.add('integration_target');
    var overlay = document.getElementById('integration_overlay');
    if(overlay) {
      var rect = overlay.getBoundingClientRect();
      div.style.width = (data.target.width_percent * rect.width) + "px";
      div.style.height = (data.target.height_percent * rect.height) + "px";
      div.style.left = (data.target.left_percent * rect.width) + "px";
      div.style.top = (data.target.top_percent * rect.height) + "px";
      overlay.appendChild(div);
      targets.push({id: data.target.id, session_id: data.session_id, target: data.target, dom: div, respond: data.respond});
      this.set('targets', targets);
      data.respond({id: data.target.id});
      if(scanner.scanning) {
        scanner.reset();
      }
    }
  },
  trigger_target_event: function(dom, type, aac_type, session_id) {
    var rect = dom.getBoundingClientRect();
    var overlay = document.getElementById('integration_overlay');
    if(overlay) {
      session_id = session_id || document.getElementById('integration_frame').getAttribute('data-session_id');
      if(session_id) {
        frame_listener.raw_event({
          session_id: session_id,
          type: type,
          aac_type: aac_type,
          clientX: rect.left + (rect.width / 2),
          clientY: rect.top + (rect.height / 2)
        });
      }
    }
  },
  size_targets: function() {
    var overlay = document.getElementById('integration_overlay');
    if(overlay) {
      var rect = overlay.getBoundingClientRect();
      (this.get('targets') || []).forEach(function(t) {
        if(t && t.dom && t.target) {
          t.dom.style.width = (t.target.width_percent * rect.width) + "px";
          t.dom.style.height = (t.target.height_percent * rect.height) + "px";
          t.dom.style.left = (t.target.left_percent * rect.width) + "px";
          t.dom.style.top = (t.target.top_percent * rect.height) + "px";
        }
      });
    }
  }.observes('app_state.speak_mode'),
  clear_target: function(data) {
    var targets = this.get('targets') || [];
    targets = targets.filter(function(t) { return t.session_id != data.session_id || t.id != data.id; });
    this.set('targets', targets);
    if(data.respond) {
      data.respond({id: data.id});
    }
  },
  clear_targets: function(data) {
    var targets = this.get('targets') || [];
    if(data == 'all') {
      targets = [];
    } else {
      targets = targets.filter(function(t) { return t.session_id != data.session_id; });
    }
    this.set('targets', targets);
    data.respond({cleared: true});
  },
  visible: function() {
    return !!document.getElementById('integration_overlay');
  },
  active_targets: function() {
    var session_id = document.getElementById('integration_frame').getAttribute('data-session_id');
    return (this.get('targets') || []).filter(function(t) { return t.session_id == session_id; });
  }
}).create({targets: []});
frame_listener.raw_listeners = raw_listeners;

window.addEventListener('message', function(event) {
  if(event.data && event.data.aac_shim) {
    var $elem = Ember.$("#integration_frame");
    event.data.respond = function(obj) {
      obj.aac_shim = true;
      obj.callback_id = event.data.callback_id;
      event.source.postMessage(obj, '*');
    };
    if(!event.data.session_id) {
      event.data.respond({error: 'session_id required, but not sent'});
      return;
    } else if(!$elem[0]) {
      event.data.respond({error: 'message came from unknown source'});
      return;
    } else if(event.source != $elem[0].contentWindow) {
      event.data.respond({error: 'message came from wrong window'});
      return;
    }
    if(!$elem.attr('data-session_id')) {
      $elem.attr('data-session_id', event.data.session_id);
    }
    frame_listener.handle_action(event.data);
  }
});

window.addEventListener('resize', function() {
  Ember.run.debounce(frame_listener, frame_listener.size_targets, 100);
});

export default frame_listener;
