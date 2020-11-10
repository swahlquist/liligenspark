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
  "germs": {path: "bacteria.svg", url: "https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/Bacteria_480_g.svg", license: {type: "CC-By", copyright_notice_url: "http://creativecommons.org/licenses/by/3.0/us/", source_url: "Maxim Kulikov", author_name: "Blair Adams", author_url: "http://thenounproject.com/maxim221"}},
  "virus": {path: "virus.png", url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/virus.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "http://catedu.es/arasaac/", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}},
  "coronavirus": {path: "bacteria2.svg", url: "https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/Bacteria_851_g.svg", license: {type: "CC-By", copyright_notice_url: "http://creativecommons.org/licenses/by/3.0/us/", source_url: "http://thenounproject.com/", author_name: "Blair Adams", author_url: "http://thenounproject.com/blairwolf"}},
  "sick": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to%20get%20sick.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "http://catedu.es/arasaac/", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "sick.png"},
  "pandemic": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/world.svg", license: {type: "CC BY-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-sa/2.0/uk", source_url: "https://mulberrysymbols.org/", author_name: "Paxtoncrafts Charitable Trust", author_url: "http://straight-street.org/lic.php"}, path: "pandemic.svg"},
  "quarantine": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/barrier_285_136215.svg", license: {type: "CC By", copyright_notice_url: "http://creativecommons.org/licenses/by/3.0/us/", source_url: "http://thenounproject.com/", author_name: "Tyler Glaude", author_url: "http://thenounproject.com/tyler.glaude"}, path: "quarantine.svg"},
  "safe": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/security.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "http://catedu.es/arasaac/", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "safe.png"},
  "social-distancing": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to%20separate_2.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "http://catedu.es/arasaac/", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "social-distancing.png"},
  "dont-touch": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/don't touch!.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "dont-touch.png"},
  "soap": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/soap.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "soap.png"},
  "sanitizer": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/liquid soap.svg", license: {type: "CC BY-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-sa/2.0/uk", source_url: "", author_name: "Paxtoncrafts Charitable Trust ", author_url: "http://straight-street.org/lic.php"}, path: "sanitizer.svg"},
  "dirty": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/dirty.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "dirty.png"},
  "clean-hands": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/clean hands.svg", license: {type: "CC BY-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-sa/2.0/uk", source_url: "", author_name: "Paxtoncrafts Charitable Trust ", author_url: "http://straight-street.org/lic.php"}, path: "clean-hands.svg"},
  "20-seconds": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/timer_398_g.svg", license: {type: "CC By", copyright_notice_url: "http://creativecommons.org/licenses/by/3.0/us/", source_url: "", author_name: "Dmitry Mamaev", author_url: "http://thenounproject.com/shushpo"}, path: "20-seconds.svg"},
  "wash-hands": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to wash one's hands.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "wash-hands.png"},
  "dry-hands": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/dry hands , to.svg", license: {type: "CC BY-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-sa/2.0/uk", source_url: "", author_name: "Paxtoncrafts Charitable Trust ", author_url: "http://straight-street.org/lic.php"}, path: "dry-hands.svg"},
  "blanket": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/blanket_1.png", license: {type: "CC BY-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-sa/2.0/uk", source_url: "", author_name: "Paxtoncrafts Charitable Trust ", author_url: "http://straight-street.org/lic.php"}, path: "blanket.png"},
  "hot": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/hot.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "hot.png"},
  "cold": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/cold_3.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "cold.png"},
  "lay": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to lay down in the bed_1.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "lay.png"},
  "yawn": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/yawn_1.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "yawn.png"},
  "snak": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/mid-morning snack_1.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "snak.png"},
  "drink": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to have.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "drink.png"},
  "thirsty": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/thirsty_1.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "thirsty.png"},
  "hungry": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/hungry.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "hungry.png"},
  "face-mask": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f637.svg", license: {type: "CC BY", copyright_notice_url: "https://creativecommons.org/licenses/by/4.0/", source_url: "https://raw.githubusercontent.com/twitter/twemoji/gh-pages/svg/1f637.svg", author_name: "Twitter. Inc.", author_url: "https://www.twitter.com"}, path: "face-mask.svg"},
  "theater": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/Theater-2fc9e1c8d3.svg", license: {type: "CC BY-SA", copyright_notice_url: "http://creativecommons.org/licenses/by/3.0/", source_url: "http://thenounproject.com/site_media/svg/76610707-1ef3-4650-ba07-57cadb8d56c5.svg", author_name: "Chiara Cozzolino", author_url: "http://thenounproject.com/chlapa"}, path: "theater.svg"},
  "mall": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/tawasol/Mall.png", license: {type: "CC BY-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-sa/4.0/", source_url: "", author_name: "Mada, HMC and University of Southampton", author_url: "http://www.tawasolsymbols.org/"}, path: "mall.png"},
  "park": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/tawasol/Park.png", license: {type: "CC BY-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-sa/4.0/", source_url: "", author_name: "Mada, HMC and University of Southampton", author_url: "http://www.tawasolsymbols.org/"}, path: "park.png"},
  "apart": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to grow apart_1.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "apart.png"},
  "shake-hands": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/shake hands.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "shake-hands.png"},
  "smell": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/sense of smell.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "smell.png"},
  "quiet": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/Quiet-Space_281_g.svg", license: {type: "public domain", copyright_notice_url: "https://creativecommons.org/publicdomain/zero/1.0/", source_url: "", author_name: "Iconathon", author_url: "http://thenounproject.com/Iconathon1"}, path: "quiet.svg"},
  "not": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/tawasol/without.jpg", license: {type: "CC BY-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-sa/4.0/", source_url: "", author_name: "Mada, HMC and University of Southampton", author_url: "http://www.tawasolsymbols.org/"}, path: "not.jpg"},
  "leave": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/tawasol/leave.jpg", license: {type: "CC BY-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-sa/4.0/", source_url: "", author_name: "Mada, HMC and University of Southampton", author_url: "http://www.tawasolsymbols.org/"}, path: "leave.jpg"},
  "noisy": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/noisy.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "noisy.png"},
  "when": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/Time-880d4b0e2b.svg", license: {type: "CC BY-SA", copyright_notice_url: "http://creativecommons.org/licenses/by/3.0/", source_url: "http://thenounproject.com/site_media/svg/13234e94-6b08-4d4d-abb8-03c7af444b62.svg", author_name: "Wayne Middleton", author_url: "http://thenounproject.com/Wayne25uk"}, path: "when.svg"},
  "medication": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/medicine.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "medication.png"},
  "flashlight": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f526.svg", license: {type: "CC BY", copyright_notice_url: "https://creativecommons.org/licenses/by/4.0/", source_url: "https://raw.githubusercontent.com/twitter/twemoji/gh-pages/svg/1f526.svg", author_name: "Twitter. Inc.", author_url: "https://www.twitter.com"}, path: "flashlight.svg"},
  "water": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/drink.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "water.png"},
  "food": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/food.svg", license: {type: "CC BY-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-sa/2.0/uk", source_url: "", author_name: "Paxtoncrafts Charitable Trust ", author_url: "http://straight-street.org/lic.php"}, path: "food.svg"},
  "money": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/Money-20ed6d2342.svg", license: {type: "CC BY-SA", copyright_notice_url: "http://creativecommons.org/licenses/by/3.0/", source_url: "http://thenounproject.com/term/money/", author_name: "Atelier Iceberg", author_url: "http://thenounproject.com/Atelier Iceberg"}, path: "money.svg"},
  "help": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/I need help.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "help.png"},
  "sand-box": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/sandbox.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "sand-box.png"},
  "headphones": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/Headphones-c99fe70250.svg", license: {type: "CC BY-SA", copyright_notice_url: "http://creativecommons.org/licenses/by/3.0/", source_url: "http://thenounproject.com/site_media/svg/c0707be8-cb67-4715-93d1-619cc7d82e35.svg", author_name: "Kevin Wynn", author_url: "http://thenounproject.com/imamkevin"}, path: "headphones.svg"},
  "cover-ears": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/ear ache_1.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "cover-ears.png"},
  "calm": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/nice_1.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "calm.png"},
  "ask": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/ask_2.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "ask.png"},
  "why": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/why.svg", license: {type: "CC BY-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-sa/2.0/uk", source_url: "", author_name: "Paxtoncrafts Charitable Trust ", author_url: "http://straight-street.org/lic.php"}, path: "why.svg"},
  "happening": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/what are you studying.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "happening.png"},
  "dont-know": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/I do not know.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "dont-know.png"},
  "home": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f3e0.svg", license: {type: "CC BY", copyright_notice_url: "https://creativecommons.org/licenses/by/4.0/", source_url: "https://raw.githubusercontent.com/twitter/twemoji/gh-pages/svg/1f3e0.svg", author_name: "Twitter. Inc.", author_url: "https://www.twitter.com"}, path: "home.svg"},
  "school": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/high school - secondary school.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "school.png"},
  "friends": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/friends_3.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "friends.png"},
  "ask2": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/so do i.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "ask2.png"},
  "take-off": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/take off cap , to.svg", license: {type: "CC BY-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-sa/2.0/uk", source_url: "", author_name: "Paxtoncrafts Charitable Trust ", author_url: "http://straight-street.org/lic.php"}, path: "take-off.svg"},
  "want": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to want.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "want.png"},
  "off": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/turn off the light_1.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "off.png"},
  "on": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/turn on the light.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "on.png"},
  "breathe": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to breathe_1.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "breathe.png"},
  "mask": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/mask_2.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "mask.png"},
  "excited": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/twemoji/1f604.svg", license: {type: "CC BY", copyright_notice_url: "https://creativecommons.org/licenses/by/4.0/", source_url: "https://raw.githubusercontent.com/twitter/twemoji/gh-pages/svg/1f604.svg", author_name: "Twitter. Inc.", author_url: "https://www.twitter.com"}, path: "excited.svg"},
  "happy": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/happy_1.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "happy.png"},
  "scared": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/scared_1.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "scared.png"},
  "bored": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to get tired.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "bored.png"},
  "sad": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/sad.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "sad.png"},
  "frustrated": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to get angry with_1.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "frustrated.png"},
  "mad": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/to get angry with_4.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "mad.png"},
  "ok": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/ok.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "ok.png"},
  "brave": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/adventure.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "brave.png"},
  "look": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/What are yopu looking at.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "look.png"},
  "next-time": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/mulberry/next month.svg", license: {type: "CC BY-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-sa/2.0/uk", source_url: "", author_name: "Paxtoncrafts Charitable Trust ", author_url: "http://straight-street.org/lic.php"}, path: "next-time.svg"},
  "ipad": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/noun-project/iPad-c88c4045fa.svg", license: {type: "CC BY-SA", copyright_notice_url: "http://creativecommons.org/licenses/by/3.0/", source_url: "http://thenounproject.com/site_media/svg/6cecc96d-a585-4100-b65c-dd73322c1aed.svg", author_name: "Michael Loupos", author_url: "http://thenounproject.com/mikeydoesit"}, path: "ipad.svg"},
  "tv": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/watch TV_1.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "tv.png"},
  "house": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/icomoon/house.svg", license: {type: "CC By-SA 3.0", copyright_notice_url: "http://creativecommons.org/licenses/by-sa/3.0/us/", source_url: "http://www.entypo.com/", author_name: "Daniel Bruce", author_url: "http://danielbruce.se/"}, path: "house.svg"},
  "bed": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/bed.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "bed.png"},
  "pet": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/pet.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "pet.png"},
  "family": {url: "https://d18vdu4p71yql0.cloudfront.net/libraries/arasaac/family_5.png", license: {type: "CC BY-NC-SA", copyright_notice_url: "http://creativecommons.org/licenses/by-nc-sa/3.0/", source_url: "", author_name: "Sergio Palao", author_url: "http://www.catedu.es/arasaac/condiciones_uso.php"}, path: "family.png"},
};
/*
require 'typhoeus'
lines = []
words.each do |word, data|
  if !data[:path] && data[:url]
    ext = data[:url].split(/\./)[-1]
    res = Typhoeus.get(URI.encode(data[:url]))
    if res.success?
      f = File.open("./public/images/emergency/#{word}.#{ext}", 'wb')
      f.write(res.body)
      f.close
      data[:path] = "#{word}.#{ext}"
    end
  end
  lines << "  \"#{word}\": #{data.to_s.gsub(/\:(\w+)=>/, '\1: ')},"
end.length
puts ""; puts ""; lines.each{|l| puts l }; puts ""; puts ""
*/
for(var key in words) {
  if(words[key] && words[key].path) {
    words[key].url = Ember.templateHelpers.path(("images/emergency/" + words[key].path));
  }
}


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
  board.extra_back = ref.starter ? 'emergency' : null;
  board.obf_type = 'emergency';
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
path = 'emergency/ussaac-hand-washing-1'
words ||= {}
b = Board.find_by_path(path)
imgs = []
lines = []
grid = BoardContent.load_content(b, 'grid')
lines << "{id: '#{path.split(/\//)[1]}', rows: #{grid['rows'].to_i}, cols: #{grid['columns'].to_i}, key: '#{path}', starter: true, buttons: [";
images = b.button_images
word_list = words.to_a
grid['order'].each do |row|
  row_content = []
  row.each do |id|
    btn = b.buttons.detect{|b| b['id'].to_s == id.to_s }
    if btn
      bi =  images.detect{|i| i.global_id == btn['image_id'] }
      word = bi && word_list.detect{|w| w[1][:url]  == bi.url }
      if word && (word[0].to_s != btn['label'].to_s)
        row_content << "{label: \"#{btn['label']}\", word: \"#{word[0]}\"}"
      else
        row_content << "{label: \"#{btn['label']}\"}"
      end
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
      [{label: "pandemic"}, {label: "quarantine"}, {label: "stay safe", word: "safe"}, {label: "social distancing", word: "social-distancing"}],
    ], license: {type: 'CC By', copyright_notice_url: 'https://creativecommons.org/licenses/by/4.0/', author_name: 'USSAAC', author_url: 'https://ussaac.org/'}},
    // {id: 'ussaac-emergency-1'},
    {id: 'ussaac-emotions-1', name: "USSAAC - Emotions (2 x 4)", rows: 2, cols: 4, key: 'emergency/ussaac-emotions-1', starter: true, buttons: [
      [{label: "I am mad", word: "mad"}, {label: "I am frustrated", word: "frustrated"}, {label: "I am sad", word: "sad"}, {label: "OK", word: "ok"}],
      [{label: "I am bored", word: "bored"}, {label: "I am scared", word: "scared"}, {label: "I am happy", word: "happy"}, {label: "I am excited", word: "excited"}],
    ], license: {type: 'CC By', copyright_notice_url: 'https://creativecommons.org/licenses/by/4.0/', author_name: 'USSAAC', author_url: 'https://ussaac.org/'}},
    {id: 'ussaac-hand-washing-1', name: "USSAAC - Hand Washing (2 x 4)", rows: 2, cols: 4, starter: true, key: 'emergency/ussaac-hand-washing-1', buttons: [
      [{label: "wash hands", word: "wash-hands"}, {label: "20 seconds", word: "20-seconds"}, {label: "dry hands", word: "dry-hands"}, {label: "clean hands", word: "clean-hands"}],
      [{label: "dirty hands", word: "dirty"}, {label: "hand sanitizer", word: "sanitizer"}, {label: "use soap", word: "soap"}, {label: "don't touch surfaces", word: "dont-touch"}],
    ]},
    {id: 'ussaac-needs-1-2', name: "USSAAC - Needs (2 x 4)", rows: 2, cols: 4, key: 'emergency/ussaac-needs-1-2', starter: true, buttons: [
      [{label: "I am hungry", word: "hungry"}, {label: " I am thirsty", word: "thirsty"}, {label: "Can I have a drink?", word: "drink"}, {label: "Can I have a snack?", word: "snak"}],
      [{label: "I am tired", word: "yawn"}, {label: "Can I Lay Down?", word: "lay"}, {label: "I am cold", word: "cold"}, {label: "Can I have a blanket?", word: "blanket"}],
    ]},
    {id: 'ussaac-mask-1', name: "USSAAC - Mask Wearing (2 x 4)", rows: 2, cols: 4, key: 'emergency/ussaac-mask-1', starter: true, buttons: [
      [{label: "Where is my mask?", word: "mask"}, {label: "I can't breathe", word: "breathe"}, {label: "face mask", word: "face-mask"}, {label: "on"}],
      [{label: "off"}, {label: "I need a mask", word: "want"}, {label: "Can I take my mask off?", word: "take-off"}, {label: "Do I need a mask?", word: "ask2"}],
    ], license: {type: 'CC By', copyright_notice_url: 'https://creativecommons.org/licenses/by/4.0/', author_name: 'USSAAC', author_url: 'https://ussaac.org/'}},
    {id: 'ussaac-questions-1', name: "USSAAC - Questions (2 x 4)", rows: 2, cols: 4, key: 'emergency/ussaac-questions-1', starter: true, buttons: [
      [{label: "Where are my friends?", word: "friends"}, {label: "When can I go back to school?", word: "school"}, {label: "When can we go home?", word: "home"}, {label: "Why me?", word: "dont-know"}],
      [{label: "What is happening?", word: "happening"}, {label: "Why us?", word: "why"}, {label: "What are we going to do?", word: "ask"}, null],
    ], license: {type: 'CC By', copyright_notice_url: 'https://creativecommons.org/licenses/by/4.0/', author_name: 'USSAAC', author_url: 'https://ussaac.org/'}},    
    {id: 'ussaac-red-cross-1', name: "USSAAC - Red Cross (2 x 4)", rows: 2, cols: 4, key: 'emergency/ussaac-red-cross-1', starter: true, buttons: [
      [{label: "I need help", word: "help"}, {label: "I need money", word: "money"}, {label: "I need food", word: "food"}, {label: "I need water", word: "water"}],
      [{label: "I need a flashlight", word: "flashlight"}, {label: "I need a blanket", word: "blanket"}, {label: "I am out of my medication", word: "medication"}, {label: "How long will we be in a shelter?", word: "when"}],
    ], license: {type: 'CC By', copyright_notice_url: 'https://creativecommons.org/licenses/by/4.0/', author_name: 'USSAAC', author_url: 'https://ussaac.org/'}},
    {id: 'ussaac-sensory-needs-1', name: "USSAAC - Sensory Needs (2 x 4)", rows: 2, cols: 4, key: 'emergency/ussaac-sensory-needs-1', starter: true, buttons: [
      [{label: "I need to calm myself down!", word: "calm"}, {label: "I need to cover my ears", word: "cover-ears"}, {label: "I need a weighted blanket", word: "blanket"}, {label: "I need noise canceling headphones", word: "headphones"}],
      [{label: "I need the sand box", word: "sand-box"}, {label: "I need a quiet space", word: "quiet"}, {label: "I need", word: "help"}, null],
    ], license: {type: 'CC By', copyright_notice_url: 'https://creativecommons.org/licenses/by/4.0/', author_name: 'USSAAC', author_url: 'https://ussaac.org/'}},    
    {id: 'ussaac-shelter-sensory-1', name: "USSAAC - Shelter Sensory Board (2 x 4)", rows: 2, cols: 4, key: 'emergency/ussaac-shelter-sensory-1', starter: true, buttons: [
      [{label: "It is too noisy!", word: "noisy"}, {label: "When are we going?", word: "leave"}, {label: "I don't want to be here!", word: "not"}, {label: "I need a quiet place.", word: "quiet"}],
      [{label: "It smells.", word: "smell"}, {label: "It is hot!", word: "hot"}, {label: "It is cold!", word: "cold"}, null],
    ], license: {type: 'CC By', copyright_notice_url: 'https://creativecommons.org/licenses/by/4.0/', author_name: 'USSAAC', author_url: 'https://ussaac.org/'}},
    {id: 'ussaac-social-distancing-1', name: "USSAAC - Social Distancing (2 x 4)", rows: 2, cols: 4, key: 'emergency/ussaac-social-distancing-1', starter: true, buttons: [
      [{label: "stay at home", word: "home"}, {label: "don't shake hands", word: "shake-hands"}, {label: "6 feet apart", word: "apart"}, {label: "no park", word: "park"}],
      [{label: "no mall", word: "mall"}, {label: "no theater", word: "theater"}, {label: "wear a face mask", word: "face-mask"}, {label: "stay safe", word: "safe"}],
    ], license: {type: 'CC By', copyright_notice_url: 'https://creativecommons.org/licenses/by/4.0/', author_name: 'USSAAC', author_url: 'https://ussaac.org/'}},
    {id: 'ussaac-statement-after-1', name: "USSAAC - Statements After the Fact (2 x 4)", rows: 2, cols: 4, key: 'emergency/ussaac-statement-after-1', starter: true, buttons: [
      [{label: "That was scary!", word: "scared"}, {label: "How will we be safe next time?", word: "next-time"}, {label: "What will happen now?", word: "look"}, {label: "Go Home", word:"home"}],
      [{label: "I don't want to be here!", word: "not"}, {label: "I will be brave!", word: "brave"}, {label: "We will be ok!", word: "ok"}, {label: "Stay together", word: "friends"}],
    ], license: {type: 'CC By', copyright_notice_url: 'https://creativecommons.org/licenses/by/4.0/', author_name: 'USSAAC', author_url: 'https://ussaac.org/'}},
    {id: 'ussaac-statement-missing-1', name: "USSAAC - Statements of Missing (2 x 4)", rows: 2, cols: 4, key: 'emergency/ussaac-statement-missing-1', starter: true, buttons: [
      [{label: "I miss my family", word: "family"}, {label: "I miss my friends", word: "friends"}, {label: "I miss my pet", word: "pet"}, {label: "I miss my bed", word: "bed"}],
      [{label: "I miss my house", word: "house"}, {label: "I miss my TV", word: "tv"}, {label: "I miss my iPad", word: "ipad"}, null],
    ], license: {type: 'CC By', copyright_notice_url: 'https://creativecommons.org/licenses/by/4.0/', author_name: 'USSAAC', author_url: 'https://ussaac.org/'}},
  ],
  es: [
    {id: 'ussaac-sensory-needs-1_7', name: "USSAAC - Necesidades Sensoriales (2 x 4)", rows: 2, cols: 4, key: 'emergency/ussaac-sensory-needs-1_7', starter: true, buttons: [
      [{label: "¡Necesito calmarme!", word: "calm"}, {label: "Necesito taparme los oídos", word: "cover-ears"}, {label: "Necesito una manta con peso", word: 'blanket'}, {label: "Necesito auriculares con cancelación de ruido", word: "headphones"}],
      [{label: "Necesito la caja de arena", word: "sand-box"}, {label: "Necesito un espacio tranquilo", word: "quiet"}, {label: "Necesito", word: "help"}, null],
    ], license: {type: 'CC By', copyright_notice_url: 'https://creativecommons.org/licenses/by/4.0/', author_name: 'USSAAC', author_url: 'https://ussaac.org/'}},
  ]
}
for(var loc in emergency.boards) {
  emergency.boards[loc].forEach(function(b) {
    b.path =  "obf/emergency-" + loc + "_" + b.id;
    b.name = b.name || b.id;
  })
}


export default emergency;
