export default {
  name: 'store-setter',
  initialize: function(instance) {
    window.CoughDrop.store = instance.lookup('service:store');
  }
};
