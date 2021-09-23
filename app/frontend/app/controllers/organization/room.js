import Controller from '@ember/controller';
import i18n from '../../utils/i18n';
import Utils from '../../utils/misc';
import persistence from '../../utils/persistence';
import modal from '../../utils/modal';
import { computed } from '@ember/object';

export default Controller.extend({
  first_log: computed('model.logs.data', function() {
    return (this.get('model.logs.data') || [])[0];
  }),
  load_stats: function() {
    var _this = this;
    _this.set('log_stats', {loading: true});
    persistence.ajax('/api/v1/units/' + _this.get('model.id') + '/log_stats', {type: 'GET'}).then(function(res) {
      res.avg_words_per_day = Math.round(10 * res.total_words / Math.max(1, res.total_user_weeks * 7)) / 10;
      res.avg_words_per_session = Math.round(10 * res.total_words / Math.max(1, res.total_sessions)) / 10;
      res.avg_modeling_per_week = Math.round(10 * res.total_models / Math.max(1, res.total_user_weeks * 7)) / 10;
      res.avg_sessions_per_user = Math.round(10 * res.total_sessions / Math.max(1, res.total_users)) / 10;
      _this.set('log_stats', res);
    }, function(err) {
      _this.set('log_stats', {error: true});
    });
  },
  actions: {
    edit_unit: function() {
      var _this = this;
      modal.open('edit-unit', {unit: _this.get('model')}).then(function(res) {
        if(res && res.updated) {
          _this.get('model').load_data(true);
        }
      });
    },
    delete_unit: function() {
      var _this = this;
      modal.open('confirm-delete-unit', {unit: _this.get('model')}).then(function(res) {
        if(res && res.deleted) {
          _this.transitionToRoute('organization.rooms', _this.get('organization.id'));
        }
      });
    },
    add_users: function() {
      var unit = this.get('model');
      unit.set('adding_users', !unit.get('adding_users'));
    },
    add_unit_user: function(user_type) {
      var unit = this.get('model');
      var action = 'add_' + user_type;
      var user_name = null;
      if(user_type.match('communicator')) {
        user_name = unit.get('communicator_user_name');
      } else {
        user_name = unit.get('supervisor_user_name');
      }
      if(!user_name) { return; }
      action = action + "-" + user_name;
      unit.set('management_action', action);
      unit.save().then(function() {
        unit.set('communicator_user_name', null);
        unit.set('supervisor_user_name', null);
      }, function() {
        modal.error(i18n.t('error_adding_user', "There was an unexpected error while trying to add the user"));
      });
    },
    refresh: function() {
      this.get('model').load_data(true);
    },
    delete_unit_user: function(unit, user_type, user_id, decision) {
      if(!decision) {
        var _this = this;
        modal.open('modals/confirm-org-action', {action: 'remove_unit_user', unit_user_name: user_id}).then(function(res) {
          if(res.confirmed) {
            _this.send('delete_unit_user', unit, user_type, user_id, true);
          }
        });
        return;
      }
      var unit = this.get('model');
      var action = 'remove_' + user_type + '-' + user_id;
      unit.set('management_action', action);
      unit.save().then(function() {
      }, function() {
        modal.error(i18n.t('error_removing_user', "There was an unexpected error while trying to remove the user"));
      });
    },
    set_goal: function(decision) {
      var _this = this;
      if(_this.get('model.goal') && !decision) {
        modal.open('modals/confirm-remove-goal', {source_type: 'unit', source: _this.get('model'), goal: _this.get('model.goal')}).then(function(res) {
          if(res.confirmed) {
            _this.send('set_goal', 'confirm');
          }
        });
        return;
      }
      modal.open('new-goal', {unit: _this.get('model')}).then(function(res) {
        if(!res || !res.get('id')) { return; }
        var unit = _this.get('model');
        unit.set('goal', {id: res.get('id')});
        unit.save().then(function() {
          modal.success(i18n.t('goal_added', "Goal successfully linked to this room!"));
        }, function(err) {
          modal.error(i18n.t('error_adding_goal', "There was an unexpected error trying to link a new goal for this room"));
        });
      });
    },
    message: function(target) {
      // modal for crafting a message
      // option to include feedback footer for communicators
      // should send a message to the communicator and all non-org supervisors of that communicator
      modal.open('modals/message-unit', {unit: this.get('model'), target: target});
    }
  }
});
