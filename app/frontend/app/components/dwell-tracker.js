import Component from '@ember/component';
import EmberObject from '@ember/object';
import { set as emberSet, get as emberGet } from '@ember/object';
import { later as runLater } from '@ember/runloop';
import $ from 'jquery';
import buttonTracker from '../utils/raw_events';
import capabilities from '../utils/capabilities';
import { observer } from '@ember/object';
import { computed } from '@ember/object';

export default Component.extend({
  draw: observer(
    'pending',
    'current_dwell',
    'screen_width',
    'screen_height',
    'event_x',
    'event_y',
    'window_x',
    'window_y',
    'selected',
    'window_width',
    'window_height',
    function() {
      var elem = this.get('element').getElementsByClassName('preview')[0];
      var coords = this.getProperties('screen_width', 'screen_height', 'event_x', 'event_y', 'window_x', 'window_y', 'window_width', 'window_height');

      var now = (new Date()).getTime();
      var ts = this.get('ts');
      this.set('current_dwell', (ts && now - ts <= 2000));
      if(!this.get('current_dwell')) { this.set('pending', false); }

      if(elem && coords && coords.screen_width) {
        var context = elem.getContext('2d');
        var width = elem.width;
        var height = elem.height;
        context.clearRect(0, 0, width, height);
        if(this.get('pending')) {
          context.fillStyle = '#fff7b7';
          context.strokeStyle = '#a59a47';
        } else if(this.get('current_dwell')) {
          context.fillStyle = '#eee';
          context.strokeStyle = '#444';
        } else {
          context.fillStyle = '#fee';
          context.strokeStyle = '#844';
        }
        context.beginPath();
        context.rect(0, 0, width, height);
        context.closePath();
        context.fill();
        context.stroke();


        var ctx_window_width = width * (coords.window_width / coords.screen_width);
        var ctx_window_height = height * (coords.window_height / coords.screen_height);
        var ctx_window_x = width * (coords.window_x / coords.screen_width);
        var ctx_window_y = height * (coords.window_y / coords.screen_height);
        if(this.get('current_dwell')) {
          context.fillStyle = '#fff';
          context.strokeStyle = '#444';
        } else {
          context.fillStyle = '#fff';
          context.strokeStyle = '#844';
        }
        context.beginPath();
        context.rect(ctx_window_x, ctx_window_y, ctx_window_width, ctx_window_height);
        context.closePath();
        context.fill();
        context.stroke();

        if(coords.event_x) {
          var ctx_point_x = width * (coords.event_x / coords.screen_width);
          var ctx_point_y = height * (coords.event_y / coords.screen_height);
          context.fillStyle = '#f00';
          if(this.get('selected')) {
            context.strokeStyle = '#742eff';
            context.fillStyle = '#3cff00';
          }
          context.beginPath();
          context.arc(ctx_point_x, ctx_point_y, 10, 0, 2*Math.PI);
          context.closePath();
          context.fill();
          if(this.get('selected')) {
            context.lineWidth = 4;
            context.stroke();
          }
        }
      }
    }
  ),
  clear_on_change: observer('type', function() {
    this.setProperties({
      ts: (new Date()).getTime(),
      pending: true,
      event_x: null,
      hardware: null
    });
  }),
  hardware_type: computed('hardware', 'source', function() {
    var res = {};
    if(this.get('hardware') && this.get('source') == 'eyegaze') {
      res[this.get('hardware')] = true;
      return res;
    } else {
      return null;
    }
  }),
  eye_tracking: computed('type', function() {
    return this.get('type') == 'eyegaze';
  }),
  update_speed: observer('preferences.device.dwell_arrow_speed', function() {
    if(buttonTracker.gamepadupdate && this.get('preferences.device.dwell_arrow_speed')) {
      buttonTracker.gamepadupdate.speed = this.get('preferences.device.dwell_arrow_speed');
    }
  }),
  didInsertElement: function() {
    var _this = this;

    _this.setProperties({
      screen_width: capabilities.screen.width,
      screen_height: capabilities.screen.height,
      pending: true,
      window_x: window.screenInnerOffsetX || window.screenX,
      window_y: window.screenInnerOffsetY || window.screenY,
      window_width: $(window).width(),
      window_height: $(window).height(),
      event_x: null,
      event_y: null,
      eye_listener: null,
      head_listener: null,
      mouse_listener: null
    });

    var head_pointer = _this.get('preferences.device.dwell_type') == 'head' && _this.get('preferences.device.dwell_head_pointer');
    if(!_this.get('preferences.device.dwell_type') || _this.get('preferences.device.dwell_type') == 'eyegaze' || head_pointer) {
      var eye_listener = function(e) {
        var ratio = window.devicePixelRatio || 1.0;
        e.screenX = ratio * (e.clientX + (window.screenInnerOffsetX || window.screenX));
        e.screenY = ratio * (e.clientY + (window.screenInnerOffsetY || window.screenY));
        _this.setProperties({
          screen_width: capabilities.screen.width,
          screen_height: capabilities.screen.height,
          event_x: e.screenX,
          event_y: e.screenY,
          pending: false,
          hardware: e.eyegaze_hardware,
          window_x: window.screenInnerOffsetX || window.screenX,
          window_y: window.screenInnerOffsetY || window.screenY,
          ts: (new Date()).getTime(),
          window_width: $(window).width(),
          window_height: $(window).height(),
          source: {eyegaze: true}
        });
      };
      capabilities.eye_gaze.listen('noisy');
      this.set('eye_listener', eye_listener);
      $(document).on('gazelinger', eye_listener);
      this.set('eye_gaze', capabilities.eye_gaze);
    }

    if(_this.get('preferences.device.dwell_type') == 'mouse_dwell') {
      var mouse_listener = function(e) {
        _this.setProperties({
          screen_width: capabilities.screen.width,
          screen_height: capabilities.screen.height,
          event_x: e.screenX,
          event_y: e.screenY,
          pending: false,
          window_x: window.screenInnerOffsetX || window.screenX,
          window_y: window.screenInnerOffsetY || window.screenY,
          ts: (new Date()).getTime(),
          window_width: $(window).width(),
          window_height: $(window).height(),
          source: {cursor: true}
        });
      };
      this.set('mouse_listener', mouse_listener);
      this.set('ts', (new Date()).getTime());
      $(document).on('mousemove', mouse_listener);
    }

    if(_this.get('preferences.device.dwell_type') == 'arrow_dwell' || (_this.get('preferences.device.dwell_type') == 'head' && !head_pointer)) {
      if(false) { //_this.get('preferences.device.dwell_type') == 'head') {
        var head_listener = function(e) {
          var event_x = _this.get('event_x') == null ? _this.get('event_x') : (capabilities.screen.width / 2);
          var event_y = _this.get('event_y') == null ? _this.get('event_y') : (capabilities.screen.height / 2);
          var window_x = window.screenInnerOffsetX || window.screenX;
          var window_y = window.screenInnerOffsetY || window.screenY;
          var window_width = $(window).width();
          var window_height = $(window).height();
          _this.setProperties({
            screen_width: capabilities.screen.width,
            screen_height: capabilities.screen.height,
            event_x: Math.min(Math.max(window_x, event_x + e.horizontal), window_x + window_width),
            event_y: Math.min(Math.max(window_y, event_y + e.vertical), window_y + window_height),
            pending: false,
            window_x: window_x,
            window_y: window_y,
            ts: (new Date()).getTime(),
            window_width: window_width,
            window_height: window_height,          
            source: {head: true}
          });
        };
        capabilities.head_tracking.listen();
        this.set('head_listener', head_listener);
        $(document).on('headtilt', head_listener);
        this.set('head_tracking', capabilities.head_tracking);
      } else {//} if(_this.get('preferences.device.dwell_type') == 'arrow_dwell') {
        var key_listener = function(e) {
          if(_this.get('preferences.device.dwell_selection') == 'button') {
            if(e.keyCode && e.keyCode == _this.get('preferences.device.scanning_select_keycode')) {
              buttonTracker.gamepadupdate('select', e);
            }
          }
        };
        $(document).on('keydown', key_listener);
        _this.set('key_listener', key_listener);
        buttonTracker.gamepadupdate = function(action, e) {
          if(action == 'select') {
            var now = (new Date()).getTime()
            _this.setProperties({
              selected: now
            })
            runLater(function() {
              if(_this.get('selected') == now) {
                _this.set('selected', null);
              }
            }, 800);
          } else if(action == 'move') {
            var window_x = window.screenInnerOffsetX || window.screenX;
            var window_y = window.screenInnerOffsetY || window.screenY;
            var window_width = $(window).width();
            var window_height = $(window).height();
            var source = {};
            source[e.activation] = true;
            _this.setProperties({
              screen_width: capabilities.screen.width,
              screen_height: capabilities.screen.height,
              event_x: e.clientX, //Math.min(Math.max(window_x, event_x + e.horizontal), window_x + window_width),
              event_y: e.clientY , //Math.min(Math.max(window_y, event_y + e.vertical), window_y + window_height),
              pending: false,
              window_x: window_x,
              window_y: window_y,
              ts: (new Date()).getTime(),
              window_width: window_width,
              window_height: window_height,          
              source: source
            });
          }
        };
        if(capabilities.head_tracking.available) {
          capabilities.head_tracking.listen();
        }

        buttonTracker.gamepadupdate.speed = _this.get('preferences.device.dwell_arrow_speed');
        _this.set('gampead_listener', buttonTracker.gamepadupdate);
      }
    }
    
    if(_this.get('preferences.device.dwell_selection') == 'expression') {
      var expression_listener = function(e) {
        if(e.expression && e.expression == _this.get('preferences.device.select_expression') == e.expression) {
          var now = (new Date()).getTime()
          _this.setProperties({
            selected: now
          })
          runLater(function() {
            if(_this.get('selected') == now) {
              _this.set('selected', null);
            }
          }, 1500);
        }
      };
      $(document).on('facechange', expression_listener);
      this.set('expression_listener', expression_listener)
      if(!this.get('head_tracking')) {
        capabilities.head_tracking.listen();
        this.set('head_tracking', capabilities.head_tracking);
      }
    }
    _this.check_timeout();

  },
  with_status: computed('eye_gaze.statuses', function() {
    return emberGet(capabilities.eye_gaze, 'statuses');
  }),
  check_timeout: function() {
    var _this = this;
    if(this.get('mouse_listener') || this.get('eye_listener') || this.get('head_listener') || this.get('gamepad_listener') || this.get('expression_listener')) {
      var now = (new Date()).getTime();
      var ts = this.get('ts');
      this.set('current_dwell', (ts && now - ts <= 2000));
      if(!this.get('current_dwell')) { this.set('pending', false); }
      runLater(function() { _this.check_timeout(); }, 100);
    }
  },
  willDestroyElement: function() {
    capabilities.eye_gaze.stop_listening();
    if(this.get('mouse_listener')) {
      $(document).off('mousemove', this.get('mouse_listener'));
      this.set('mouse_listener', null);
    }
    if(this.get('eye_listener')) {
      $(document).off('gazelinger', this.get('eye_listener'));
      this.set('eye_listener', null);
    }
    if(this.get('head_listener')) {
      $(document).off('headtilt', this.get('head_listener'));
      this.set('head_listener', null);
    }
    if(this.get('key_listener')) {
      $(document).off('keydown', this.get('key_listener'));
      this.set('key_listener', null);
    }
    if(this.get('gampead_listener')) {
      this.set('gamepad_listener', null);
    }
    if(this.get('keycode_listener')) {
      $(document).off('keypress', this.get('keycode_listener'));
      this.set('keycode_listener', null);
    }
    if(this.get('expression_listener')) {
      $(document).off('facechange', this.get('expression_listener'));
      this.set('expression_listener', null);
    }
  },
  actions: {
    advanced: function() {
      this.set('advanced', true);
    }
  }
});
