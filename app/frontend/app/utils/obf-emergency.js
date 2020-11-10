import Ember from 'ember';
import app_state from './app_state';
import speecher from './speecher';
import persistence from './persistence';
import { later as runLater } from '@ember/runloop';
import utterance from './utterance';
import obf from './obf';
import modal from './modal';
import i18n from './i18n';
import $ from 'jquery';
import { htmlSafe } from '@ember/string';
import stashes from './_stashes';
import capabilities from './capabilities';
import { set as emberSet, observer } from '@ember/object';


// select language when starting assessment

var emergency = {
  register: function() {
    obf.register("eval", emergency.callback);
    obf.emergency = emergency;
  },
};

var words = {
  "germs": {url: Ember.templateHelpers.path('images/emergency/bacteria.svg'), license: {type: "CC-By", copyright_notice_url: "http://creativecommons.org/licenses/by/3.0/us/", source_url: "Maxim Kulikov", author_name: "Blair Adams", author_url: "http://thenounproject.com/maxim221"}},
  "virus": {url: Ember.templateHelpers.path('images/emergency/virus.png'), license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "http://catedu.es/arasaac/", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}},
  "coronavirus": {url: Ember.templateHelpers.path('images/emergency/bacteria2.svg'), license: {type: "CC-By", copyright_notice_url: "http://creativecommons.org/licenses/by/3.0/us/", source_url: "http://thenounproject.com/", author_name: "Blair Adams", author_url: "http://thenounproject.com/blairwolf"}},
  "sick": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to%20get%20sick.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "http://catedu.es/arasaac/", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}},
  "pandemic": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/world.svg", license: {type: "CC BY-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-sa/2.0/uk", source_url: "https://mulberrysymbols.org/", author_name: "Paxtoncrafts Charitable Trust", author_url: "http://straight-street.org/lic.php"}},
  "quarantine": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/barrier_285_136215.svg", license: {type: "CC By", copyright_notice_url: "http://creativecommons.org/licenses/by/3.0/us/", source_url: "http://thenounproject.com/", author_name: "Tyler Glaude", author_url: "http://thenounproject.com/tyler.glaude"}},
  "stay safe": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/security.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "http://catedu.es/arasaac/", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}},
  "social distancing": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to%20separate_2.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "http://catedu.es/arasaac/", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}},
  "don't touch surfaces": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/don't touch!.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "use soap": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/soap.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "hand sanitizer": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/liquid soap.svg", license: {type: 'CC BY-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-sa/2.0/uk', source_url: '', author_name: 'Paxtoncrafts Charitable Trust ', author_url: 'http://straight-street.org/lic.php'}},
  "dirty hands": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/dirty.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "clean hands": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/clean hands.svg", license: {type: 'CC BY-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-sa/2.0/uk', source_url: '', author_name: 'Paxtoncrafts Charitable Trust ', author_url: 'http://straight-street.org/lic.php'}},
  "20 seconds": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/timer_398_g.svg", license: {type: 'CC By', copyright_notice_url: 'http://creativecommons.org/licenses/by/3.0/us/', source_url: '', author_name: 'Dmitry Mamaev', author_url: 'http://thenounproject.com/shushpo'}},
  "wash hands": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to wash one's hands.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "dry hands": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/dry hands , to.svg", license: {type: 'CC BY-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-sa/2.0/uk', source_url: '', author_name: 'Paxtoncrafts Charitable Trust ', author_url: 'http://straight-street.org/lic.php'}},
  "Can I have a blanket?": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/blanket.svg", license: {type: 'CC BY-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-sa/2.0/uk', source_url: '', author_name: 'Paxtoncrafts Charitable Trust ', author_url: 'http://straight-street.org/lic.php'}},
  "I am cold": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/cold_3.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "Can I Lay Down?": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to lay down in the bed_1.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "I am tired": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/yawn_1.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "Can I have a snack?": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/mid-morning snack_1.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "Can I have a drink?": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to have.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "I am thirsty": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/thirsty_1.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "I am hungry": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/hungry.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "stay safe": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/security.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "wear a face mask": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f637.svg", license: {type: 'CC BY', copyright_notice_url: 'https://creativecommons.org/licenses/by/4.0/', source_url: 'https://raw.githubusercontent.com/twitter/twemoji/gh-pages/svg/1f637.svg', author_name: 'Twitter. Inc.', author_url: 'https://www.twitter.com'}},
  "no theater": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/Theater-2fc9e1c8d3.svg", license: {type: 'CC BY-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by/3.0/', source_url: 'http://thenounproject.com/site_media/svg/76610707-1ef3-4650-ba07-57cadb8d56c5.svg', author_name: 'Chiara Cozzolino', author_url: 'http://thenounproject.com/chlapa'}},
  "no mall": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/tawasol/Mall.png", license: {type: 'CC BY-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-sa/4.0/', source_url: '', author_name: 'Mada, HMC and University of Southampton', author_url: 'http://www.tawasolsymbols.org/'}},
  "no park": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/tawasol/Park.png", license: {type: 'CC BY-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-sa/4.0/', source_url: '', author_name: 'Mada, HMC and University of Southampton', author_url: 'http://www.tawasolsymbols.org/'}},
  "6 feet apart": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to grow apart_1.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "don't shake hands": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/shake hands.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "stay at home": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/home.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "It is cold!": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/cold_3.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "It is hot!": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/hot.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "It smells.": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/sense of smell.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "I need a quiet place.": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/Quiet-Space_281_g.svg", license: {type: 'public domain', copyright_notice_url: 'https://creativecommons.org/publicdomain/zero/1.0/', source_url: '', author_name: 'Iconathon', author_url: 'http://thenounproject.com/Iconathon1'}},
  "I don't want to be here!": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/tawasol/without.jpg", license: {type: 'CC BY-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-sa/4.0/', source_url: '', author_name: 'Mada, HMC and University of Southampton', author_url: 'http://www.tawasolsymbols.org/'}},
  "When are we going?": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/tawasol/leave.jpg", license: {type: 'CC BY-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-sa/4.0/', source_url: '', author_name: 'Mada, HMC and University of Southampton', author_url: 'http://www.tawasolsymbols.org/'}},
  "It is too noisy!": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/noisy.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "How long will we be in a shelter?": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/Time-880d4b0e2b.svg", license: {type: 'CC BY-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by/3.0/', source_url: 'http://thenounproject.com/site_media/svg/13234e94-6b08-4d4d-abb8-03c7af444b62.svg', author_name: 'Wayne Middleton', author_url: 'http://thenounproject.com/Wayne25uk'}},
  "I am out of my medication": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/medicine.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "I need a blanket": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/blanket_1.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "I need a flashlight": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f526.svg", license: {type: 'CC BY', copyright_notice_url: 'https://creativecommons.org/licenses/by/4.0/', source_url: 'https://raw.githubusercontent.com/twitter/twemoji/gh-pages/svg/1f526.svg', author_name: 'Twitter. Inc.', author_url: 'https://www.twitter.com'}},
  "I need water": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/drink.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "I need food": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/food.svg", license: {type: 'CC BY-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-sa/2.0/uk', source_url: '', author_name: 'Paxtoncrafts Charitable Trust ', author_url: 'http://straight-street.org/lic.php'}},
  "I need money": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/Money-20ed6d2342.svg", license: {type: 'CC BY-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by/3.0/', source_url: 'http://thenounproject.com/term/money/', author_name: 'Atelier Iceberg', author_url: 'http://thenounproject.com/Atelier Iceberg'}},
  "I need help": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/I need help.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},  
  "I need": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/I need help.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "I need a quiet space": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/Quiet-Space_281_g.svg", license: {type: 'public domain', copyright_notice_url: 'https://creativecommons.org/publicdomain/zero/1.0/', source_url: '', author_name: 'Iconathon', author_url: 'http://thenounproject.com/Iconathon1'}},
  "I need the sand box": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/sandbox.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "I need noise canceling headphones": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/Headphones-c99fe70250.svg", license: {type: 'CC BY-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by/3.0/', source_url: 'http://thenounproject.com/site_media/svg/c0707be8-cb67-4715-93d1-619cc7d82e35.svg', author_name: 'Kevin Wynn', author_url: 'http://thenounproject.com/imamkevin'}},
  "I need a weighted blanket": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/blanket_1.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "I need to cover my ears": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/ear ache_1.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "I need to calm myself down!": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/nice_1.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "What are we going to do?": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/ask_2.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "Why us?": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/why.svg", license: {type: 'CC BY-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-sa/2.0/uk', source_url: '', author_name: 'Paxtoncrafts Charitable Trust ', author_url: 'http://straight-street.org/lic.php'}},
  "What is happening?": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/what are you studying.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "Why me?": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/I do not know.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "When can we go home?": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f3e0.svg", license: {type: 'CC BY', copyright_notice_url: 'https://creativecommons.org/licenses/by/4.0/', source_url: 'https://raw.githubusercontent.com/twitter/twemoji/gh-pages/svg/1f3e0.svg', author_name: 'Twitter. Inc.', author_url: 'https://www.twitter.com'}},
  "When can I go back to school?": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/high school - secondary school.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "Where are my friends?": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/friends_3.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "Do I need a mask?": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/so do i.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "Can I take my mask off?": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/take off cap , to.svg", license: {type: 'CC BY-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-sa/2.0/uk', source_url: '', author_name: 'Paxtoncrafts Charitable Trust ', author_url: 'http://straight-street.org/lic.php'}},
  "I need a mask": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to want.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "off": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/turn off the light_1.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "on": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/turn on the light.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "face mask": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f637.svg", license: {type: 'CC BY', copyright_notice_url: 'https://creativecommons.org/licenses/by/4.0/', source_url: 'https://raw.githubusercontent.com/twitter/twemoji/gh-pages/svg/1f637.svg', author_name: 'Twitter. Inc.', author_url: 'https://www.twitter.com'}},
  "I can't breathe": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to breathe_1.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},
  "Where is my mask?": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/mask_2.png", license: {type: 'CC BY-NC-SA', copyright_notice_url: 'http://creativecommons.org/licenses/by-nc-sa/3.0/', source_url: '', author_name: 'Sergio Palao', author_url: 'http://www.catedu.es/arasaac/condiciones_uso.php'}},  
};


emergency.callback = function(key) {
  var suffix = key.replace(/^emergency-/, '');
  var parts = suffix.split(/_/);
  var locale = parts.length > 1 ? parts[0] : 'en';
  var id = parts.length > 1 ? parts[1] : parts[0];
  var ref = null;
  if(emergency.boards[locale]) {
    ref = emergency.boards[locale].find(function(b) { return b.id == id; }) || emergency.boards[locale][0];
  }
  ref = ref || emergency.boards.en[0];
  obf.offline_urls = obf.offline_urls || [];
  if(!words.prefetched) {
    for(var key in words) {
      if(words[key] && words[key].url.match(/^http/)) {
        obf.offline_urls.push(words[key].url);
      }
    }
    words.prefetched = true;
    emergency.words = words;
  }
  var res = {};
  var board = obf.shell(ref.rows, ref.cols);
  board.name = ref.name || ref.id;
  board.public = true;
  board.source_key = ref.key;
  board.license = ref.license;
  // {
  //   type: "CC-By", 
  //   copyright_notice_url: "http://creativecommons.org/licenses/by/3.0/us/", 
  //   source_url: "http://thenounproject.com/maxim221/Maxim+Kulikov", 
  //   author_name: "Blair Adams", 
  //   author_url: "http://thenounproject.com/maxim221"
  // };
  ref.buttons.forEach(function(row, idx) {
    row.forEach(function(button, jdx) {
      if(button && button.label) {
        var btn = {
          label: button.label
        };
        if(words[button.label] || words[button.word]) {
          btn.image = (words[button.label] || words[button.word]);
        }
        board.add_button(btn, idx, jdx)  
      }
    });
  });
  res.handler = function(button, obj) {

    // runLater(function() {
    //   app_state.jump_to_board({key: 'obf/eval-' + working.level + "-" + working.step + "-" + working.attempts});
    //   app_state.set_history([]);  
    //   utterance.clear();
    // }, button.id == 'button_done' ? 200 : 1000);
    // return {ignore: true, highlight: false, sound: false};
    return {auto_return: false};
  };
  if(board) {
    res.json = board.to_json();
  }
  return res;
};

/*
path = 'emergency/ussaac-hand-washing-1';
b = Board.find_by_path(path)
imgs = []
lines = []
grid = BoardContent.load_content(b, 'grid')
lines << "{id: '#{path.split(/\//)[1]}', rows: #{grid['rows'].to_i}, cols: #{grid['columns'].to_i}, key: '#{path}', buttons: [";
grid['order'].each do |row|
  row_content = []
  row.each do |id|
    btn = b.buttons.detect{|b| b['id'].to_s == id.to_s }
    if btn
    row_content << "{label: \"#{btn['label']}\"}"
    else
    row_content << 'null'
    end
  end
  lines << "  [#{row_content.join(', ')}],";
end
lines << "], license: {type: '#{b.settings['license']['type']}', copyright_notice_url: '#{b.settings['license']['copyright_notice_url']}', author_name: '#{b.settings['license']['author_name']}', author_url: '#{b.settings['license']['author_url']}'}},"
b.button_images.each do |bi|
  btn = b.buttons.detect{|b| b['image_id'] == bi.global_id }
  if btn && bi
    lines << "\"#{btn['label']}\": {url: \"#{bi.url}\", license: {type: '#{bi.settings['license']['type']}', copyright_notice_url: '#{bi.settings['license']['copyright_notice_url']}', source_url: '#{bi.settings['license']['source_url']}', author_name: '#{bi.settings['license']['author_name']}', author_url: '#{bi.settings['license']['author_url']}'}},"
  end
end
puts ""; lines.each{|l| puts l}; puts ""
*/

emergency.boards = {
  // https://ussaac.org/news/communication_tools_category/communication-tools/
  en: [
    {id: 'ussaac-covid-1', name: "USSAAC - Covid General Terms (2 x 4)", rows: 2, cols: 4, key: 'emergency/ussaac-covid-1', starter: true, buttons: [
      [{label: "germs"}, {label: "virus"}, {label: "coronavirus"}, {label: "sick"}],
      [{label: "pandemic"}, {label: "quarantine"}, {label: "stay safe"}, {label: "social distancing"}]
    ]},
    // {id: 'ussaac-emergency-1'},
    {id: 'ussaac-emotions-1', name: "USSAAC - Emotions (2 x 4)", rows: 2, cols: 4, starter: true, buttons: [
      [{label: "I am mad", word: 'mad'}, {label: "I am frustrated", word: 'frustrated'}, {label: "I am sad", word: 'sad'}, {label: "OK", word: 'ok'},],
      [{label: "I am bored", word: 'bored'}, {label: "I am scared", word: 'scared'}, {label: "I am happy", word: 'happy'}, {label: "I am excited", word: 'excited'},],
    ]},
    {id: 'ussaac-hand-washing-1', name: "USSAAC - Hand Washing (2 x 4)", rows: 2, cols: 4, starter: true, key: 'emergency/ussaac-hand-washing-1', buttons: [
      [{label: "wash hands"}, {label: "20 seconds"}, {label: "dry hands"}, {label: "clean hands"}],
      [{label: "dirty hands"}, {label: "hand sanitizer"}, {label: "use soap"}, {label: "don't touch surfaces"}],
    ]},
    {id: 'ussaac-needs-1-2', name: "USSAAC - Needs (2 x 4)", rows: 2, cols: 4, key: 'emergency/ussaac-needs-1-2', starter: true, buttons: [
      [{label: "I am hungry"}, {label: "I am thirsty"}, {label: "Can I have a drink?"}, {label: "Can I have a snack?"}],
      [{label: "I am tired"}, {label: "Can I Lay Down?"}, {label: "I am cold"}, {label: "Can I have a blanket?"}],
    ]},
    {id: 'ussaac-mask-1', name: "USSAAC - Mask Wearing (2 x 4)", rows: 2, cols: 4, key: 'emergency/ussaac-mask-1', starter: true, buttons: [
      [{label: "Where is my mask?"}, {label: "I can't breathe"}, {label: "face mask"}, {label: "on"}],
      [{label: "off"}, {label: "I need a mask"}, {label: "Can I take my mask off?"}, {label: "Do I need a mask?"}],
    ], license: {type: 'CC By', copyright_notice_url: 'https://creativecommons.org/licenses/by/4.0/', author_name: 'USSAAC', author_url: 'https://ussaac.org/'}},
    {id: 'ussaac-questions-1', name: "USSAAC - Questions (2 x 4)", rows: 2, cols: 4, key: 'emergency/ussaac-questions-1', buttons: [
      [{label: "Where are my friends?"}, {label: "When can I go back to school?"}, {label: "When can we go home?"}, {label: "Why me?"}],
      [{label: "What is happening?"}, {label: "Why us?"}, {label: "What are we going to do?"}, null],
    ], license: {type: 'CC By', copyright_notice_url: 'https://creativecommons.org/licenses/by/4.0/', author_name: 'USSAAC', author_url: 'https://ussaac.org/'}},    
    {id: 'ussaac-red-cross-1', name: "USSAAC - Red Crosss (2 x 4)", rows: 2, cols: 4, key: 'emergency/ussaac-red-cross-1', buttons: [
      [{label: "I need help"}, {label: "I need money"}, {label: "I need food"}, {label: "I need water"}],
      [{label: "I need a flashlight"}, {label: "I need a blanket"}, {label: "I am out of my medication"}, {label: "How long will we be in a shelter?"}],
    ], license: {type: 'CC By', copyright_notice_url: 'https://creativecommons.org/licenses/by/4.0/', author_name: 'USSAAC', author_url: 'https://ussaac.org/'}},
    {id: 'ussaac-sensory-needs-1', name: "USSAAC - Sensory Needs (2 x 4)", rows: 2, cols: 4, key: 'emergency/ussaac-sensory-needs-1', starter: true, buttons: [
      [{label: "I need to calm myself down!"}, {label: "I need to cover my ears"}, {label: "I need a weighted blanket"}, {label: "I need noise canceling headphones"}],
      [{label: "I need the sand box"}, {label: "I need a quiet space"}, {label: "I need"}, null],
    ], license: {type: 'CC By', copyright_notice_url: 'https://creativecommons.org/licenses/by/4.0/', author_name: 'USSAAC', author_url: 'https://ussaac.org/'}},    
    {id: 'ussaac-shelter-sensory-1', name: "USSAAC - Shelter Sensory Board (2 x 4)", rows: 2, cols: 4, key: 'emergency/ussaac-shelter-sensory-1', starter: true, buttons: [
      [{label: "It is too noisy!"}, {label: "When are we going?"}, {label: "I don't want to be here!"}, {label: "I need a quiet place."}],
      [{label: "It smells."}, {label: "It is hot!"}, {label: "It is cold!"}, null],
    ], license: {type: 'CC By', copyright_notice_url: 'https://creativecommons.org/licenses/by/4.0/', author_name: 'USSAAC', author_url: 'https://ussaac.org/'}},
    {id: 'ussaac-social-distancing-1', name: "USSAAC - Social Distancing (2 x 4)", rows: 2, cols: 4, key: 'emergency/ussaac-social-distancing-1', starter: true, buttons: [
      [{label: "stay at home"}, {label: "don't shake hands"}, {label: "6 feet apart"}, {label: "no park"}],
      [{label: "no mall"}, {label: "no theater"}, {label: "wear a face mask"}, {label: "stay safe"}],
    ], license: {type: 'CC By', copyright_notice_url: 'https://creativecommons.org/licenses/by/4.0/', author_name: 'USSAAC', author_url: 'https://ussaac.org/'}},
    {id: 'ussaac-statement-after-1', name: "USSAAC - Statements After the Fact (2 x 4)", rows: 2, cols: 4, key: 'emergency/ussaac-statement-after-1', starter: true, buttons: [
      [{label: "That was scary!"}, {label: "How will we be safe next time?"}, {label: "What will happen now?"}, {label: "Go Home"}],
      [{label: "I don't want to be here!"}, {label: "I will be brave!"}, {label: "We will be ok!"}, {label: "Stay together"}],
    ], license: {type: 'CC By', copyright_notice_url: 'https://creativecommons.org/licenses/by/4.0/', author_name: 'USSAAC', author_url: 'https://ussaac.org/'}},
    {id: 'ussaac-statement-missing-1', name: "USSAAC - Statements of Missing (2 x 4)", rows: 2, cols: 4, key: 'emergency/ussaac-statement-missing-1', starter: true, buttons: [
      [{label: "I miss my family"}, {label: "I miss my friends"}, {label: "I miss my pet"}, {label: "I miss my bed"}],
      [{label: "I miss my house"}, {label: "I miss my TV"}, {label: "I miss my iPad"}, null],
    ], license: {type: 'CC By', copyright_notice_url: 'https://creativecommons.org/licenses/by/4.0/', author_name: 'USSAAC', author_url: 'https://ussaac.org/'}},
  ],
  es: [
    {id: 'assdf', starter: true}
  ]
}
for(var loc in emergency.boards) {
  emergency.boards[loc].forEach(function(b) {
    b.path =  "obf/emergency-" + b.id;
    b.name = b.name || b.id;
  })
}


export default emergency;
