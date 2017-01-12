import { context, it, expect, stub, waitsFor, runs } from 'frontend/tests/helpers/jasmine';
import Button from '../../utils/button';
import app_state from '../../utils/app_state';
import persistence from '../../utils/persistence';
import progress_tracker from '../../utils/progress_tracker';
import Ember from 'ember';

context('Button', function() {
  context("actions", function() {
    it("should set default action attributes", function() {
      var button = Button.create();
      expect(button.get('buttonAction')).toEqual('talk');
      expect(button.get('talkAction')).toEqual(true);
      expect(button.get('folderAction')).toEqual(false);
    });
    it("should keep boolean action attributes in sync based on load_board with action value", function() {
      var button = Button.create({load_board: {}});
      expect(button.get('buttonAction')).toEqual('folder');
      expect(button.get('talkAction')).toEqual(false);
      expect(button.get('folderAction')).toEqual(true);
      button.set('load_board', null);
      expect(button.get('buttonAction')).toEqual('talk');
      expect(button.get('talkAction')).toEqual(true);
      expect(button.get('folderAction')).toEqual(false);
    });
  });

  it("should run this test once", function() {
    expect(1).toEqual(1);
  });

  context("raw", function() {
    it("should return a plain object", function() {
      var button = Button.create();
      expect(button.raw()).toEqual({});
      button.setProperties({
        label: "hat",
        background_color: "#fff"
      });
      expect(button.raw()).toEqual({label: 'hat', background_color: '#fff'});
    });
    it("should only pull defined attributes", function() {
      var button = Button.create({
        label: "hat",
        background_color: "#fff",
        chicken: true,
        talkAction: 'ok'
      });
      expect(button.raw()).toEqual({label: 'hat', background_color: '#fff'});
    });

  });

  context("integration type buttons", function() {
    it("should identify integration-type buttons", function() {
      var b = Button.create();
      expect(b.get('integrationAction')).toEqual(false);
      b.set('integration', {});
      expect(b.get('integrationAction')).toEqual(true);
    });

    it("should return the correct action_image for integration-type buttons in different states", function() {
      var b = Button.create();
      expect(b.get('action_image')).toEqual('/images/talk.png');
      b.set('integration', {});
      expect(b.get('action_image')).toEqual('/images/action.png');
      b.set('action_status', {pending: true});
      expect(b.get('action_image')).toEqual('/images/clock.png');
      b.set('action_status', {errored: true});
      expect(b.get('action_image')).toEqual('/images/error.png');
      b.set('action_status', {completed: true});
      expect(b.get('action_image')).toEqual('/images/check.png');
      b.set('action_status', {nothing: true});
      expect(b.get('action_image')).toEqual('/images/action.png');
    });
  });

  context("extra_actions", function() {
    it("should do nothing for an invalid button", function() {
      Button.extra_actions(null);
      var b = Button.create();
      Button.extra_actions(b);
      expect(b.get('action_status')).toEqual(undefined);
    });

    it("should do nothing for non-integration buttons", function() {
      var b = Button.create();
      Button.extra_actions(b);
      expect(b.get('action_status')).toEqual(undefined);
    });

    it("should trigger an error when not online", function() {
      app_state.set('sessionUser', Ember.Object.create({id: '123'}));
      app_state.set('currentBoardState', {id: '234'});
      persistence.set('online', false);
      var b = Button.create({integration: {action_type: 'webhook'}});
      Button.extra_actions(b);
      expect(b.get('action_status.errored')).toEqual(true);
    });

    it("should not trigger an error for a non-webhook integration", function() {
      app_state.set('sessionUser', Ember.Object.create({id: '123'}));
      app_state.set('currentBoardState', {id: '234'});
      persistence.set('online', false);
      var b = Button.create({integration: {action_type: 'render'}});
      Button.extra_actions(b);
      expect(b.get('action_status.errored')).toEqual(null);
    });

    it("should trigger a remote call for integration buttons", function() {
      app_state.set('sessionUser', Ember.Object.create({id: '123'}));
      app_state.set('currentBoardState', {id: '234'});
      var b = Button.create({integration: {action_type: 'webhook'}});
      persistence.set('online', true);
      var ajax_opts = null;
      var ajax_url = null;
      stub(persistence, 'ajax', function(url, opts) {
        ajax_url = url;
        ajax_opts = opts;
        return Ember.RSVP.reject();
      });
      Button.extra_actions(b);
      waitsFor(function(r) { return ajax_opts; });
      runs(function() {
        expect(ajax_url).toEqual('/api/v1/users/123/activate_button');
        expect(ajax_opts.data.board_id).toEqual('234');
      });
    });

    it("should handle ajax errors for remote calls", function() {
      app_state.set('sessionUser', Ember.Object.create({id: '123'}));
      app_state.set('currentBoardState', {id: '234'});
      var b = Button.create({integration: {action_type: 'webhook'}});
      persistence.set('online', true);
      var ajax_opts = null;
      var ajax_url = null;
      stub(persistence, 'ajax', function(url, opts) {
        ajax_url = url;
        ajax_opts = opts;
        expect(b.get('action_status.pending')).toEqual(true);
        return Ember.RSVP.reject();
      });
      Button.extra_actions(b);
      waitsFor(function(r) { return ajax_opts; });
      runs(function() {
        expect(ajax_url).toEqual('/api/v1/users/123/activate_button');
        expect(ajax_opts.data.board_id).toEqual('234');
        expect(b.get('action_status.errored')).toEqual(true);
      });
    });

    it("should handle missing progress response", function() {
      app_state.set('sessionUser', Ember.Object.create({id: '123'}));
      app_state.set('currentBoardState', {id: '234'});
      var b = Button.create({integration: {action_type: 'webhook'}});
      persistence.set('online', true);
      var ajax_opts = null;
      var ajax_url = null;
      stub(persistence, 'ajax', function(url, opts) {
        ajax_url = url;
        ajax_opts = opts;
        expect(b.get('action_status.pending')).toEqual(true);
        return Ember.RSVP.resolve({progress: null});
      });
      Button.extra_actions(b);
      waitsFor(function(r) { return ajax_opts; });
      runs(function() {
        expect(ajax_url).toEqual('/api/v1/users/123/activate_button');
        expect(ajax_opts.data.board_id).toEqual('234');
        expect(b.get('action_status.errored')).toEqual(true);
      });
    });

    it("should track progress for remote calls", function() {
      app_state.set('sessionUser', Ember.Object.create({id: '123'}));
      app_state.set('currentBoardState', {id: '234'});
      var b = Button.create({integration: {action_type: 'webhook'}});
      persistence.set('online', true);
      var ajax_opts = null;
      var ajax_url = null;
      stub(persistence, 'ajax', function(url, opts) {
        ajax_url = url;
        ajax_opts = opts;
        expect(b.get('action_status.pending')).toEqual(true);
        return Ember.RSVP.resolve({progress: 'asdf'});
      });
      var tracked = false;
      stub(progress_tracker, 'track', function(progress, callback) {
        expect(progress).toEqual('asdf');
        tracked = true;
      });
      Button.extra_actions(b);
      waitsFor(function() { return ajax_opts; });
      runs(function() {
        expect(ajax_url).toEqual('/api/v1/users/123/activate_button');
        expect(ajax_opts.data.board_id).toEqual('234');
      });
      waitsFor(function() { return tracked; });
      runs();
    });

    it("should handle errors on progress tracking", function() {
      app_state.set('sessionUser', Ember.Object.create({id: '123'}));
      app_state.set('currentBoardState', {id: '234'});
      var b = Button.create({integration: {action_type: 'webhook'}});
      persistence.set('online', true);
      var ajax_opts = null;
      var ajax_url = null;
      stub(persistence, 'ajax', function(url, opts) {
        ajax_url = url;
        ajax_opts = opts;
        expect(b.get('action_status.pending')).toEqual(true);
        return Ember.RSVP.resolve({progress: 'asdf'});
      });
      var tracked = false;
      stub(progress_tracker, 'track', function(progress, callback) {
        expect(progress).toEqual('asdf');
        tracked = true;
        callback({status: 'errored'});
      });
      Button.extra_actions(b);
      waitsFor(function() { return ajax_opts; });
      runs(function() {
        expect(ajax_url).toEqual('/api/v1/users/123/activate_button');
        expect(ajax_opts.data.board_id).toEqual('234');
      });
      waitsFor(function() { return tracked; });
      runs(function() {
        expect(b.get('action_status.errored')).toEqual(true);
      });
    });

    it("should mark successful progresses with no responses as failed", function() {
      app_state.set('sessionUser', Ember.Object.create({id: '123'}));
      app_state.set('currentBoardState', {id: '234'});
      var b = Button.create({integration: {action_type: 'webhook'}});
      persistence.set('online', true);
      var ajax_opts = null;
      var ajax_url = null;
      stub(persistence, 'ajax', function(url, opts) {
        ajax_url = url;
        ajax_opts = opts;
        expect(b.get('action_status.pending')).toEqual(true);
        return Ember.RSVP.resolve({progress: 'asdf'});
      });
      var tracked = false;
      stub(progress_tracker, 'track', function(progress, callback) {
        expect(progress).toEqual('asdf');
        tracked = true;
        callback({status: 'finished', result: []});
      });
      Button.extra_actions(b);
      waitsFor(function() { return ajax_opts; });
      runs(function() {
        expect(ajax_url).toEqual('/api/v1/users/123/activate_button');
        expect(ajax_opts.data.board_id).toEqual('234');
      });
      waitsFor(function() { return tracked; });
      runs(function() {
        expect(b.get('action_status.errored')).toEqual(true);
      });
    });
    it("should mark successful progresses with any error codes as failed", function() {
      app_state.set('sessionUser', Ember.Object.create({id: '123'}));
      app_state.set('currentBoardState', {id: '234'});
      var b = Button.create({integration: {action_type: 'webhook'}});
      persistence.set('online', true);
      var ajax_opts = null;
      var ajax_url = null;
      stub(persistence, 'ajax', function(url, opts) {
        ajax_url = url;
        ajax_opts = opts;
        expect(b.get('action_status.pending')).toEqual(true);
        return Ember.RSVP.resolve({progress: 'asdf'});
      });
      var tracked = false;
      stub(progress_tracker, 'track', function(progress, callback) {
        expect(progress).toEqual('asdf');
        tracked = true;
        callback({status: 'finished', result: [{response_code: 200}, {response_code: 400}]});
      });
      Button.extra_actions(b);
      waitsFor(function() { return ajax_opts; });
      runs(function() {
        expect(ajax_url).toEqual('/api/v1/users/123/activate_button');
        expect(ajax_opts.data.board_id).toEqual('234');
      });
      waitsFor(function() { return tracked; });
      runs(function() {
        expect(b.get('action_status.errored')).toEqual(true);
      });
    });
    it("should mark successful progresses with success codes as succeeded", function() {
      app_state.set('sessionUser', Ember.Object.create({id: '123'}));
      app_state.set('currentBoardState', {id: '234'});
      var b = Button.create({integration: {action_type: 'webhook'}});
      persistence.set('online', true);
      var ajax_opts = null;
      var ajax_url = null;
      stub(persistence, 'ajax', function(url, opts) {
        ajax_url = url;
        ajax_opts = opts;
        expect(b.get('action_status.pending')).toEqual(true);
        return Ember.RSVP.resolve({progress: 'asdf'});
      });
      var tracked = false;
      stub(progress_tracker, 'track', function(progress, callback) {
        expect(progress).toEqual('asdf');
        tracked = true;
        callback({status: 'finished', result: [{response_code: 200}, {response_code: 210}]});
      });
      Button.extra_actions(b);
      waitsFor(function() { return ajax_opts; });
      runs(function() {
        expect(ajax_url).toEqual('/api/v1/users/123/activate_button');
        expect(ajax_opts.data.board_id).toEqual('234');
      });
      waitsFor(function() { return tracked; });
      runs(function() {
        expect(b.get('action_status.completed')).toEqual(true);
      });
    });
  });
  it("should run this test once too", function() {
    expect(1).toEqual(1);
  });
});
