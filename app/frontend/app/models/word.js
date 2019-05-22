import Ember from 'ember';
import DS from 'ember-data';
import CoughDrop from '../app';

CoughDrop.Word = DS.Model.extend({
  word: DS.attr('string'),
  locale: DS.attr('string'),
  parts_of_speech: DS.attr('raw'),
  primary_part_of_speech: DS.attr('string'),
  inflection_overrides: DS.attr('raw'),
});

export default CoughDrop.Word;
