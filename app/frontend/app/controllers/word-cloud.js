import modal from '../utils/modal';

export default modal.ModalController.extend({
  opening: function() {
    this.render_cloud();
  },
  zoom: 1.0,
  stretch_ratio: function() {
    return this.get('model.stats2') ? 2.0 : null;
  }.property('model.stats2'),
  render_cloud: function() {
    this.set('word_cloud_id', Math.random());
  },
  actions: {
    refresh: function() {
      this.render_cloud();
    },
    zoom: function(direction) {
      if(direction == 'in') {
        this.set('zoom', Math.round(this.get('zoom') * 1.2 * 10.0) / 10.0);
      } else {
        this.set('zoom', Math.round(this.get('zoom') / 1.2 * 10.0) / 10.0);
      }
      this.render_cloud();
    }
  }
});