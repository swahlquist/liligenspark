import Ember from 'ember';
import app_state from './app_state';

var raw_listeners = {};
var frame_listener = Ember.Object.extend({
  handle_action: function(data) {
    data.respond = data.respond || function() { };
    if(data.action == 'listen') {
      this.listen(data);
    } else if(data.action == 'stop_listening') {
      this.stop_listening(data);
    } else if(data.action == 'get_user_data') {
      this.get_user_data(data);
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
    }
  },
  unload: function() {
    this.stop_listening('all');
    this.clear_targets('all');
  },
  listen: function(data) {
    var id = (new Date().getTime()) + "_" + Math.random();
    raw_listeners[data.session_id + id] = data;
    data.respond({listen_id: id});
  },
  stop_listening: function(data) {
    if(data == 'all') {
      for(var idx in raw_listeners) {
        if(raw_listeners[idx]) {
          delete raw_listeners[idx];
        }
      }
    } else if(data.listen_id == 'all') {
      for(var idx in raw_listeners) {
        if(raw_listeners[idx] && data.session_id && idx.index_of(data.session_id) === 0) {
          delete raw_listeners[idx];
        }
      }
    } else {
      delete raw_listeners[data.session_id + data.listen_id];
    }
  },
  raw_event: function(event) {
    for(var idx in raw_listeners) {
      if(raw_listeners[idx] && raw_listeners[idx].session_id == event.session_id && raw_listeners[idx].respond) {
        raw_listeners[idx].respond(event);
      }
    }
    // propagate to active listeners
  },
  get_user_data: function(data) {
    var allowed = false;
    if(allowed) {
      data.respond({
        user_name: app_state.get('currentUser.user_name')
      });
    } else {
      data.respond({error: 'user data not authorized'});
    }
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

    data.respond({error: 'not implemented'});
  },
  update_manifest: function(data) {
    // { html_url: '', script_url: '', state: {key: 'values', only: 'folks'}, objects: [{url: '', type: 'image'}] }
    data.respond({error: 'not implemented'});
  },
  retrieve_object: function(data) {
    data.respond({error: 'not implemented'});
  },
  trigger_target: function(ref) {
    var target = (this.get('targets') || []).find(function(t) { return t.session_id == ref.session_id && t.id == ref.id; });
    if(target && target.respond) {
      target.respond({
        selected: true
      });
    }
  },
  add_target: function(data) {
    var targets = this.get('targets') || [];
    targets = targets.filter(function(t) { return t.session_id != data.session_id || t.id != data.id; });
    targets.push(data);
    this.set('targets', targets);
    data.respond({id: data.id});
  },
  clear_target: function(data) {
    var targets = this.get('targets') || [];
    targets = targets.filter(function(t) { return t.session_id != data.session_id || t.id != data.id; });
    this.set('targets', targets);
    data.respond({id: data.id});
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
  }
}).create({targets: []});

window.on('message', function(event) {
  if(event.data && event.data.aac_shim) {
    event.data.respond = function(obj) {
      obj.aac_shim = true;
      obj.callback_id = event.data.callback_id;
      event.source.postMessage(obj);
    };
    if(!event.data.session_id) {
      event.data.response({error: 'session_id required, but not sent'});
      return;
    }
    frame_listener.handle_action(event.data);
  }
});

export default frame_listener;
