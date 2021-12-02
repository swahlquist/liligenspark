import Component from '@ember/component';
import CoughDrop from '../../app';
import i18n from '../../utils/i18n';
import { observer } from '@ember/object';

export default Component.extend({
  didInsertElement: function() {
    this.draw();
  },
  draw: observer('total', 'recent', function() {
    var total = this.get('total');
    var recent = this.get('recent');
    var elem = this.get('element').getElementsByClassName('recent_profiles')[0];

    var _this = this;
    CoughDrop.Visualizations.wait('pie-chart', function() {
      if(elem && total) {
        var table = [
          ['Type', 'Total']
        ];
        table.push([i18n.t('goal_tracked', "Has Recent Profile"), recent]);
        table.push([i18n.t('untracked_goal', "No Recent Profile"), total - recent]);
        var data = window.google.visualization.arrayToDataTable(table);

        var options = {
          title: _this.get('type') == 'communicator' ? i18n.t('communicator_profiles', "Communicator Profiles") : i18n.t('supervisor_profiles', "Supervisor Profiles"),
          legend: {
            position: 'top',
            maxLines: 2
          },
          slices: {
            0: {color: "#3881ff"},
            1: {color: "#ffa099"},
          }
        };

        var chart = new window.google.visualization.PieChart(elem);
        chart.draw(data, options);
      }
    });
  })
});

