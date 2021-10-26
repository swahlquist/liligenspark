import Ember from 'ember';
import EmberObject from '@ember/object';
import { observer } from '@ember/object';
import { computed } from '@ember/object';
import RSVP from 'rsvp';
import { htmlSafe } from '@ember/string';
import i18n from './i18n';
import CoughDrop from '../app';

// TODO: track locale of response
// TODO: place to store translations of labels and prompts and placeholders

var sample_profile = {
  name: "Sample Profile",
  id: "sample",
  version: "0.1",
  description: "blah blah blah",
  score_categories: {
    total: {
      label: "Total Score",
      function: "sum",
      border: [71, 91, 172],
      background: [212, 227, 255]
    },
    sleep: {
      label: "Sleep Section",
      function: "avg",
      border: [153, 63, 60],
      background: [255, 207, 206]
    },
    eating: {
      label: "Eating",
      function: "mastery_cnt",
      border: [77, 128, 62],
      background: [187, 240, 170]
    },
    a: {
      label: "A Value",
      function: "sum",
      brackets: [
        [0, "F"], [1, "D"], [1.3, "C"], [4, "B"], [5, "A"]
      ]
    },
    b: {
      label: "B Value",
      function: "sum",
      brackets: [
        [0, "Z"], [1, "Y"], [2, "X"], [3, "W"], [4, "V"]
      ]
    },
    c: {
      label: "C Value",
      function: "sum",
      brackets: [
        [0, "F"], [1, "D"], [1.3, "C"], [4, "B"], [5, "A"]
      ]
    },
    d: {
      label: "D Value",
      function: "sum",
      brackets: [
        [0, "Z"], [1, "Y"], [2, "X"], [3, "W"], [4, "V"]
      ]
    }
  },
  answer_blocks: {
    frequency: {
      type: 'multiple_choice',
      answers: [
        {id: 'never', label: "Never", score: 0},
        {id: 'sometimes', label: "Sometimes", score: 1, mastery: true},
        {id: 'usually', label: "Usually", score: 2, mastery: true}
      ]
    },
    communication_modes: {
      type: 'check_all',
      answers: [
        {id: 'eyes', label: "Eyes", score: 1},
        {id: 'hands', label: "Hands", score: 1},
        {id: 'voice', label: "Voice", score: 2}
      ]
    },
    free_response: {
      type: 'text',
      hint: "Notes/Explanation/etc."
    }
  },
  question_groups: [
    {
      id: "sleep",
      label: "Sleep",
      repeatable: "on_mastery",
      mastery_threshold: "all",
      questions: [
        {
          id: "naps",
          label: "Takes naps during the day",
          answer_block: "frequency",
          score_categories: {
            total: 1.0,
            sleep: 0.5,
            a: 1.0,
            b: 1.0,
            c: 1.0,
            d: 1.0
          }
        },
        {
          id: "eats",
          label: "Takes bites of food by mouth",
          answer_block: "frequency",
          score_categories: {
            total: 1.0,
            eating: 0.5,
            c: 1.0,
            d: 1.0
          }
        },
        {
          id: "expl",
          label: "Notes",
          answer_block: "free_response",
        }
      ]
    }
  ],
  report_segments: [
    {
      type: "score",
      score_category: "total",
      summary: true,
    },
    {
      type: "score",
      score_category: "b"
    },
    {
      type: "weights",
      score_categories: ["sleep", "eating"]
    },
    {
      type: 'concat',
      label: "A-B Score",
      score_categories: ['a', 'b'],
      border: [255, 91, 172],
      join: '.'
    },
    {
      type: 'table',
      rows: [
        "Level 1", "Level 2", "Level 3"
      ],
      columns: [
        "Sleep", "Sleep", "Eat", "Eat", "Eat", "Other"
      ],
      cells: [
        ['a', 'a', 'b', 'b', null, null],
        ['a', 'a', null, null, null, null],
        [null, null, null, 'c', 'd']
      ]
    },
    {
      type: 'raw'
    }
  ]
};

var Profile = EmberObject.extend({
  init: function() {
    this.set('started', this.get('started') || this.get('template.started') || (new Date()).getTime() / 1000);
    this.set('encrypted_results', this.get('encrypted_results') || this.get('template.encrypted_results'));
    this.set('history', this.get('history') || this.get('template.history'));
  },
  questions_layout: computed('template.score_categories', 'template.answer_blocks', 'template.question_groups', 'results', function() {
    var list = [];
    var blocks = this.get('template.answer_blocks');
    var results = (this.get('results') || {}).responses || {};
    var show_results = Object.keys(results).length > 0;
    this.get('template.question_groups').forEach(function(group) {
      var style = "";
      if(group.border) {
        var rgb = group.border.map(function(n) { return parseInt(n, 10); }).join(', ');
        style = style + "border-color: rgb(" + rgb + "); ";
      }
      if(group.background) {
        var rgb = group.background.map(function(n) { return parseInt(n, 10); }).join(', ');
        style = style + "background-color: rgb(" + rgb + "); ";
        var avg = (group.background[0] + group.background[1] + group.background[2]) / 3;
        if(avg < 150) {
          style = style + "color: #fff; ";
        }
      }
      list.push({
        id: group.id,
        header: true,
        hader_style: htmlSafe(style),
        label: group.label
      });
      group.questions.forEach(function(question) {
        var block = blocks[question.answer_block];
        var answers = [];
        (block.answers || []).forEach(function(answer) {
          var ans = {
            id: answer.id,
            label: answer.label,
            score: answer.score,
            mastery: !!answer.mastery
          };
          if(show_results) {
            if(results[question.id] && results[question.id].answers && results[question.id].answers[answer.id]) {
              ans.selected = true;
            }
          }
          // ans.selected = true if showing results, or question_group.repeatable
          answers.push(ans);
        });
        var answer_type = {};
        if(block.type == 'text') {
          answer_type.hint = block.hint;
        }
        answer_type[block.type] = true;
        var question_item = {
          id: question.id,
          group_id: group.id,
          label: question.label,
          answer_type: answer_type,
          answers: answers
        }
        if(show_results) {
          if(results[question.id] && results[question.id].text) {
            question_item.text_response = results[question.id].text;
          }
        }
        list.push(question_item);
      })
    });
    return list; 
  }),
  started_at: computed('started', function() {
    return window.moment(this.get('started') * 1000);
  }),
  minutes: computed('results.started', 'results.submitted', function() {
    var diff = this.get('results.submitted') - this.get('results.started');
    return Math.round(diff / 60);
  }),
  reports_layout: computed('template.report_segments', 'template.score_categories', 'questions_layout', 'history', 'template.history', 'started_at', function() {
    var reports = this.get('template.report_segments') || [];
    var cats = this.get('template.score_categories') || {};
    var date = this.get('started_at');
    var history = this.get('history') || this.get('template.history') || [];
    var res = [];
    var _this = this;
    reports.forEach(function(report) {
      // include history if available
      if(report.type == 'score') {
        var data = {
          score: true,
          history: [],
          date: date
        };
        if(report.score_category && cats[report.score_category]) {
          data.label = cats[report.score_category].label;
          data.value = cats[report.score_category].value;
          data.pre_value = cats[report.score_category].pre_value;
          if(cats[report.score_category].border) {
            var rgb = cats[report.score_category].border.map(function(n) { return parseInt(n, 10); }).join(', ');
            data.circle_style = htmlSafe("border-color: rgb(" + rgb + ");");
            data.summary_color = cats[report.score_category].border;
          }
          if(report.summary) {
            data.summary = data.summary || data.value;
          }
        }
        history.slice(-3).forEach(function(prof) {
          var started = prof.started && window.moment(prof.started * 1000);
          var age_days = (date - started) / 1000 / 60 / 60 / 24;
          var age_class = 'age_recent';
          if(age_days > 365 * 2) {
            age_class = 'age_twoyear';
          } else if(age_days > 365) {
            age_class = 'age_year';
          } else if(age_days > 365 / 2) {
            age_class = 'age_halfyear';
          } else if(age_days > 60) {
            age_class = 'age_twomonth';
          } else if(age_days > 30) {
            age_class = 'age_month';
          }
          var value = ((prof.score_categories || {})[report.score_category] || {}).value;
          var pre_value = ((prof.score_categories || {})[report.score_category] || {}).pre_value;
          if(value != null) {
            data.history.push({
              age: age_days,
              value: value,
              pre_value: pre_value,
              date: started,
              circle_class: "score_circle prior " + age_class
            });  
          }
        });
        res.push(data);
      } else if(report.type == 'weights') {
        var data = {
          weights: true,
          categories: []
        };
        report.score_categories.forEach(function(cat) {
          var score_cat = {
            label: cats[cat].label,
            value: cats[cat].value,
            max: cats[cat].max,
            history: []
          };
          score_cat.bar_style = "";
          var pct = Math.round(cats[cat].value / cats[cat].max * 100);
          score_cat.bar_style = "width: " + pct + "%; ";
          score_cat.prior_value = score_cat.value / 2;
          score_cat.prior_max = score_cat.max;

          if(cats[cat].border) {
            if(cats[cat].background) {
              score_cat.bar_style = score_cat.bar_style + htmlSafe("border-color: rgb(" + cats[cat].border.map(function(n) { return parseInt(n, 10); }).join(', ') + "); background: rgb(" + cats[cat].background.map(function(n) { return parseInt(n, 10); }).join(', ') + ");");
              score_cat.bar_bg_style = htmlSafe("border-top-color: rgb(" + cats[cat].background.map(function(n) { return parseInt(n, 10); }).join(', ') + ");");
            }
          }
  
          history.slice(-2).forEach(function(prof) {
            var value = ((prof.score_categories || {})[cat] || {}).value;
            var max = ((prof.score_categories || {})[cat] || {}).max;
            var pct = Math.round(value / max * 100);
            var started = prof.started && window.moment(prof.started * 1000);
            if(value != null) {
              score_cat.prior = value;
            }
            score_cat.history.push({
              value: value,
              bar_style: "width: calc(" + (pct) + "% - 4px);",
              max: max,
              date: started
            });
          });
          data.categories.push(score_cat);
        });
        res.push(data);
      } else if(report.type == 'concat') {
        var data = {
          concat: true,
          label: report.label,
          scores: [],
          history: [],
          date: date
        };
        if(report.border) {
          var rgb = report.border.map(function(n) { return parseInt(n, 10); }).join(', ');
          data.border_style = htmlSafe("border-color: rgb(" + rgb + ");");
        }
        (report.score_categories || []).forEach(function(cat) {
          data.scores.push(cats[cat].value || "?");
        });
        data.value = data.scores.join(report.join || '-');
        if(report.summary) {
          data.summary_color = report.border;
          data.summary = data.summary || data.value;
        }

        history.slice(-3).forEach(function(prof) {
          var started = prof.started && window.moment(prof.started * 1000);
          var age_days = (date - started) / 1000 / 60 / 60 / 24;
          var age_class = 'age_recent';
          if(age_days > 365 * 2) {
            age_class = 'age_twoyear';
          } else if(age_days > 365) {
            age_class = 'age_year';
          } else if(age_days > 365 / 2) {
            age_class = 'age_halfyear';
          } else if(age_days > 60) {
            age_class = 'age_twomonth';
          } else if(age_days > 30) {
            age_class = 'age_month';
          }
          var scores = [];
          (report.score_categories || []).forEach(function(cat) {
            var value = ((prof.score_categories || {})[cat] || {}).value;
            scores.push(value || "?");
          });
          data.history.push({
            age: age_days,
            value: scores.join(report.join || '-'),
            date: prof.started && window.moment(prof.started * 1000),
            circle_class: "score_circle wide prior " + age_class
          });  
        });
        res.push(data);
      } else if(report.type == 'table') {
      } else if(report.type == 'raw') {
        res.push({
          raw: true,
          questions: _this.get('questions_layout')
        });
      }
    });
    return res;
  }),
  decrypt_results: function(nonce) {
    // For a new profile, if the last attempt was less than
    // 18 months ago, use it to pre-populate repeatable sections
    this.set('results', []);
    var _this = this;
    return new RSVP.Promise(function(resolve, reject) {
      var enc = _this.get('encrypted_results');
      if(enc.nonce_id != nonce.id) { 
        debugger 
        reject({error: 'nonce mismatch'});
      }
      _this.decrypt(enc.msg, enc.iv, nonce).then(function(str) {
        var json = JSON.parse(str);
        console.log('decrypted:', json);
        _this.set('results', json);
        resolve(json);
      }, function(err) { 
        debugger 
        reject(err);
      });
    });
  },
  encryption_key: function(nonce) {
    var te = new TextEncoder();
    return new RSVP.Promise(function(resolve, reject) {
      window.crypto.subtle.importKey(
        "raw",
        te.encode(nonce.key),
        {   //this is the algorithm options
            name: "AES-GCM",
        },
        false, //whether the key is extractable (i.e. can be used in exportKey)
        ["encrypt", "decrypt"] //can "encrypt", "decrypt", "wrapKey", or "unwrapKey"
      ).then(function(res) { resolve(res); }, function(err) { reject(err); });
    });
  },
  decrypt: function(msg_64, iv_64, nonce) {
    var te = new TextEncoder();
    var bytes = Uint8Array.from(atob(msg_64), c => c.charCodeAt(0));
    var iv_arr = Uint8Array.from(atob(iv_64), c => c.charCodeAt(0));
    var _this = this;

    return new RSVP.Promise(function(resolve, reject) {
      _this.encryption_key(nonce).then(function(key) {
        window.crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: iv_arr,
            additionalData: te.encode(nonce.extra),
            tagLength: 128
          },
          key,
          bytes
        ).then(function(res) {
          resolve(String.fromCharCode.apply(null, new Uint8Array(res)));
        }, function(err) { reject(err); });
      }, function(err) { reject(err); });
    });
  },
  encrypt: function(msg, nonce) {
    var now = (new Date()).getTime() / 1000;
    var iv_arr = new Uint8Array(12);
    window.crypto.getRandomValues(iv_arr);
    var iv = btoa(String.fromCharCode.apply(null, new Uint8Array(iv_arr)));
    var te = new TextEncoder();
    var _this = this;

    return new RSVP.Promise(function(resolve, reject) {
      _this.encryption_key(nonce).then(function(key) {
        window.crypto.subtle.encrypt(
          {
            name: "AES-GCM",
            iv: iv_arr,
            additionalData: te.encode(nonce.extra),
            tagLength: 128
          },
          key,
          te.encode(msg)
        ).then(function(res) {
          var str = btoa(String.fromCharCode.apply(null, new Uint8Array(res)));
          resolve({nonce_id: nonce.id, iv: iv, msg: str, ts: now});
        }, function(err) { reject(err); });
      }, function(err) { reject(err); });
    });
  },
  output_json: function(nonce) {
    // try to submit directly or add it to the user's log
    // doesn't have to be complete, can be resumed later if not finished
    // once finished can't be revised?
    // need a way to save locally if offline and paused for a minute
    // maybe need a way to save to logs multiple times
    // to prevent losing data or confusing save options
    var template = this.get('template');
    var json = JSON.parse(JSON.stringify(template));
    json.results = {
      started: this.get('started'),
      submitted: (new Date()).getTime() / 1000,
      responses: {}
    };
    json.started = this.get('started');
    json.guid = nonce.id + "-" + Math.round(json.results.submitted) + "-" + Math.round(999999 * Math.random());
    var questions = this.get('questions_layout');
    var responses = json.results.responses;
    questions.forEach(function(question) {
      var template_group = json.question_groups.find(function(g) { return g.id == question.group_id; });
      var template_question = ((template_group || {}).questions || []).find(function(q) { return q.id == question.id; });
      var template_block = json.answer_blocks[question.answer_block];
      if(!question.header && question.id) {
        responses[question.id] = {};
        if(question.text_response) {
          responses[question.id].text = question.text_response;
        }
        if(question.answers) {
          responses[question.id].answers = {};
          question.answers.forEach(function(answer) {
            responses[question.id].answers[answer.id] = !!answer.selected;
            if(answer.selected && answer.mastery) {
              responses[question.id].mastered = true;
            }
            if(answer.selected) {
              responses[question.id].score = (responses[question.id].score || 0) + answer.score;
            }
            if(answer.selected && template_question.score_categories) {
              for(var cat_id in template_question.score_categories) {
                var cat = json.score_categories[cat_id];
                if(cat) {
                  cat.tally = (cat.tally || 0) + (template_question.score_categories[cat_id] * answer.score)
                  cat.cnt = (cat.cnt || 0) + 1;
                  if(answer.mastery) {
                    cat.mastery_cnt = (cat.mastery_cnt || 0) + 1;
                  }
                }
              }
            }
          });
          var max_score = Math.max.apply(null, question.answers.map(function(a) { return a.score; }));
          for(var cat_id in template_question.score_categories) {
            var mult = template_question.score_categories[cat_id] || 1.0;
            var cat = json.score_categories[cat_id];
            if(cat) {
              cat.max = (cat.max || 0) + (max_score * mult);
              if(cat.function == 'sum') {
                cat.value = cat.tally || 0;
              } else if(cat.function == 'avg') {
                cat.value = ((cat.tally || 0) / (cat.cnt || 1));
                cat.max = cat.max / (cat.cnt || 1);
              } else if(cat.function == 'mastery_cnt') {
                cat.value = cat.mastery_cnt || 0;
                cat.max = cat.cnt || 1;
              }
              if(cat.brackets) {
                cat.pre_value = cat.value;
                cat.brackets.forEach(function(b, idx) {
                  if(idx == 0 || cat.pre_value > b[0]) {
                    cat.value = b[1];
                  }
                })
              }
            }
          }
        }
      }
    });
    var throwaway = profiles.process(json);
    throwaway.get('reports_layout').forEach(function(r) { 
      if(r.summary && !json.summary) {
        json.summary = json.summary || r.summary;
        json.summary_color = r.summary_color;
      }
    });


    var _this = this;
    return new RSVP.Promise(function(resolve, reject) {
      _this.encrypt(JSON.stringify(json.results), nonce).then(function(enc) {
        delete json['results'];
        json['encrypted_results'] = enc;
        // _this.decrypt(enc.msg, enc.iv, nonce).then(function(str) {
        //   console.log('decrypted:', JSON.parse(str));
        // }, function(err) { debugger });
        resolve(json);
      }, function(err) {
        debugger
      });
    });
    // add answers to question_groups section (include answer timestamp?)
    // add numerical values to and date to report_segments
    // add date information (encrypted?)
    // do not add user information
    // demographic information must be stored separately
    // consider encrypting all answers, but not report summaries
    // keep a table of user_id-seed mappings
    // the encryption key uses the seed and also the server encryption, so a db dump isn't enough to compromise it
    // encrypt and decrypt profile responses client-side (server-side could do it, but this gets us in the habit of doing it client-side)
    // in the future it should be possible to move the mapping table to a third-party site
    // this would prevent future server access to profile data without consent from the third party
    // when adding as a logmessage, instead of storing an id, store the seed that can be used to generate the id (same table?)
    // to store to the server:
    //   request an encryption key and map the key's prefix to its seed for future access
    //     salt: crypto.getRandomValues(new Uint8Array(16));
    //   encrypt with the key and a salt
    //   send the salt and key prefix along with the encrypted payload
    //   after an id is generated, lookup seed from prefix and map id to seed and remove any other seed references
    // to retrieve from the server:
    //   get the encryption key and payload in separate requests
    // https://github.com/mdn/dom-examples/blob/master/web-crypto/encrypt-decrypt/aes-gcm.js

  //   kkey = await window.crypto.subtle.importKey(
  //     "raw", //can be "jwk" or "raw"
  //     te.encode("12345678901234567890123456789012"),
  //     {   //this is the algorithm options
  //         name: "AES-GCM",
  //     },
  //     true, //whether the key is extractable (i.e. can be used in exportKey)
  //     ["encrypt", "decrypt"] //can "encrypt", "decrypt", "wrapKey", or "unwrapKey"
  // ) 
  //   msg = "TCWv4gdG2yP4fHvcB97Kn1dkJrtejobXYsQUn4j2+LaVSo9msQ==\n" 
  //   //bytes= [76, 37, 175, 226, 7, 70, 219, 35, 248, 124, 123, 220, 7, 222, 202, 159, 87, 100, 38, 187, 94, 142, 134, 215, 98, 196, 20, 159, 136, 246, 248, 182, 149, 74, 143, 102, 177]
  //   bytes = Uint8Array.from(atob(msg), c => c.charCodeAt(0))
  //   bb = new Uint8Array(bytes)
  //   res = await window.crypto.subtle.decrypt(
  //     {
  //       name: "AES-GCM",
  //       iv: te.encode(iv),
  //       additionalData: te.encode('bacon'),
  //       tagLength: 128
  //     },
  //     kkey,
  //     bb
  //   );
  //   td.decode(res)
  //   btoa(String.fromCharCode.apply(null, new Uint8Array(res)));

  //   res = await window.crypto.subtle.encrypt(
  //     {
  //       name: "AES-GCM",
  //       iv: te.encode(iv),
  //       additionalData: te.encode('bacon'),
  //       tagLength: 128
  //     },
  //     kkey,
  //     te.encode("whatever")
  //   );
  //   td.decode(res)
  //   btoa(String.fromCharCode.apply(null, new Uint8Array(res)));
  }
});


var profiles = {
  template: function(id) {
    return new RSVP.Promise(function(resolve, reject) {
      if(id == 'sample') {
        resolve(profiles.process(sample_profile));
      } else if(id == 'cole') {
        resolve(profiles.process(cole_profile));
      } else {
        CoughDrop.store.findRecord('profile', id).then(function(prof) {
          resolve(profiles.process(prof.get('template')));
        }, function(err) {
          reject(err);
        })
      }
    });
  },
  process: function(json) {
    if(typeof(json) == 'string') {
      json = JSON.parse(json);
    }
    return Profile.create({template: json});
  }
};

var cole_profile = {
  name: "COLE - LCPS Continuum Of Language Expression",
  id: "cole",
  version: "0.1",
  description: "The Interactive LCPS Continuum Of Language Expression",
  score_categories: {
    cole: {
      label: "COLE Score",
      function: "sum",
      border: [166, 83, 98],
      background: [255, 191, 203]
    },
    stage_1: {
      label: "Stage 1",
      function: "mastery_cnt",
      border: [26, 55, 130],
      background: [171, 194, 255]
    },
    stage_2: {
      label: "Stage 2",
      function: "mastery_cnt",
      border: [90, 117, 150],
      background: [173, 203, 240]
    },
    stage_3: {
      label: "Stage 3",
      function: "mastery_cnt",
      border: [103, 161, 184],
      background: [194, 236, 252]
    },
    stage_4: {
      label: "Stage 4",
      function: "mastery_cnt",
      border: [117, 195, 217],
      background: [196, 242, 255]
    },
    stage_5: {
      label: "Stage 5",
      function: "mastery_cnt",
      border: [119, 202, 209],
      background: [196, 250, 255]
    },
    stage_6: {
      label: "Stage 6",
      function: "mastery_cnt",
      border: [124, 217, 207],
      background: [207, 255, 250]
    },
    stage_7: {
      label: "Stage 7",
      function: "mastery_cnt",
      border: [110, 186, 165],
      background: [188, 245, 229]
    },
    stage_8: {
      label: "Stage 8",
      function: "mastery_cnt",
      border: [100, 179, 134],
      background: [171, 245, 203]
    },
    stage_9: {
      label: "Stage 9",
      function: "mastery_cnt",
      border: [83, 181, 108],
      background: [154, 230, 173]
    },
    stage_10: {
      label: "Stage 10",
      function: "mastery_cnt",
      border: [84, 156, 89],
      background: [162, 224, 166]
    },
    stage_11: {
      label: "Stage 11",
      function: "mastery_cnt",
      border: [77, 133, 72],
      background: [158, 224, 153]
    },
  },
  answer_blocks: {
    frequency: {
      type: 'multiple_choice',
      answers: [
        {id: 'never', label: "Not Observed", score: 0},
        {id: 'occasionally', label: "Occasionally", score: 1},
        {id: 'usually', label: "Usually", score: 2, mastery: true},
        {id: 'always', label: "Always", score: 3, mastery: true}
      ]
    },
    free_response: {
      type: 'text',
      hint: "Evidence/Documentation/Notes:"
    }

  },
  question_groups: [
    {
      id: "stage_1",
      label: "Stage 1",
      border: [26, 55, 130],
      background: [171, 194, 255],
      questions: [
        {
          id: "q11",
          label: "Cries when uncomfortable.",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_1: 1.0,
          }
        },
        {
          id: "q12",
          label: "Smiles, coos, giggles, or otherwise shows enjoyment when attention is given.",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_1: 1.0,
          }
        },
        {
          id: "q13",
          label: "Glances at a person or visual stimulation for one second.",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_1: 1.0,
          }
        },
        {
          id: "q14",
          label: "Shows a physical response to noise (turns head, stops moving, jumps, etc.).",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_1: 1.0,
          }
        },
        {
          id: "q1text",
          label: "Notes:",
          answer_block: 'free_response'
        },
      ]      
    },
    {
      id: "stage_2",
      label: "Stage 2",
      border: [90, 117, 150],
      background: [173, 203, 240],
      questions: [
        {
          id: "q21",
          label: "Looks at a person or visual stimulation for a sustained time (3 seconds or more).",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_2: 1.0,
          }
        },
        {
          id: "q22",
          label: "Makes one sound besides crying such as producing a vowel-like sound (Ah, Uh, Ee, gurgles, sighs, grunts, squeals).",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_2: 1.0,
          }
        },
        {
          id: "q23",
          label: "Imitates a facial expression, such as a smile.",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_2: 1.0,
          }
        },
        {
          id: "q2text",
          label: "Notes:",
          answer_block: 'free_response'
        },
      ]
    },
    {
      id: "stage_3",
      label: "Stage 3",
      border: [103, 161, 184],
      background: [194, 236, 252],
      questions: [
        {
          id: "q31",
          label: "Anticipates what will happen next within a familiar routine (laughs, closes eyes, tenses body, etc.) ",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_3: 1.0,
          }
        },
        {
          id: "q32",
          label: "Protests by gesturing or vocalizing.",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_3: 1.0,
          }
        },
        {
          id: "q33",
          label: "Vocalizes at least two different sounds such as /puh/, /guh/, /ee/, /ah/",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_3: 1.0,
          }
        },
        {
          id: "q34",
          label: "Reaches for, touches, or points to what is wanted when only one thing is present.",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_3: 1.0,
          }
        },
        {
          id: "q35",
          label: "Imitates some vocalizations.",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_3: 1.0,
          }
        },
        {
          id: "q3text",
          label: "Notes:",
          answer_block: 'free_response'
        },
      ]
    },
    {
      id: "stage_4",
      label: "Stage 4",
      border: [117, 195, 217],
      background: [196, 242, 255],
      questions: [
        {
          id: "q41",
          label: "Gets attention from others using gestures or behaviors (such as leading an adult, purposefully throwing items, pushing an  item to an adult, etc.)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_4: 1.0,
          }
        },
        {
          id: "q42",
          label: "Babbles at least two syllables together (not necessarily with meaning) such as /gah gah/, /gah bee",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_4: 1.0,
          }
        },
        {
          id: "q43",
          label: "Takes two turns during playful interactions with another person (peekaboo, knocking blocks down, etc.)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_4: 1.0,
          }
        },
        {
          id: "q44",
          label: "Attempts to imitate some single words.",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_4: 1.0,
          }
        },
        {
          id: "q45",
          label: "Reaches for, touches, or points to what is wanted when two options are presented (making a choice between two).",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_4: 1.0,
          }
        },
        {
          id: "q4text",
          label: "Notes:",
          answer_block: 'free_response'
        },
      ]
    },
    {
      id: "stage_5",
      label: "Stage 5",
      border: [119, 202, 209],
      background: [196, 250, 255],
      questions: [
        {
          id: "q51",
          label: "Spontaneously produces at least one word (or approximation) with any intent which includes verbalizing pointing at a picture, signing, or using a speech generating device.",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_5: 1.0,
          }
        },
        {
          id: "q52",
          label: "Initiates a social exchange (including turn-taking, greetings, chasing games, show objects to others, etc.)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_5: 1.0,
          }
        },
        {
          id: "q5text",
          label: "Notes:",
          answer_block: 'free_response'
        },
      ]
    },
    {
      id: "stage_6",
      label: "Stage 6",
      border: [124, 217, 207],
      background: [207, 255, 250],
      questions: [
        {
          id: "q61",
          label: "Produces a total of three different words (total number of words known in vocabulary/lexicon).",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_6: 1.0,
          }
        },
        {
          id: "q62",
          label: "Produces a single word to indicate location (ex. up, there, here, down, on, in).",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_6: 1.0,
          }
        },
        {
          id: "q63",
          label: "Produces a single word to ask a question (ex. go? where? mine? more?).",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_6: 1.0,
          }
        },
        {
          id: "q64",
          label: "Produces a single word to answer a question (ex. yes, no, here, there, it, mine, that, this).",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_6: 1.0,
          }
        },
        {
          id: "q65",
          label: "Produces a single word to make a request (ex. mine, want, help, go, finished, come, look).",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_6: 1.0,
          }
        },
        {
          id: "q66",
          label: "Produces a single word to label (ex. it, that, this, you, me).",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_6: 1.0,
          }
        },
        {
          id: "q67",
          label: "Produces a single word to indicate ownership (ex. mine, you, your, me).",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_6: 1.0,
          }
        },
        {
          id: "q68",
          label: "Produces a single word to protest (ex. no, stop, finished, mine).",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_6: 1.0,
          }
        },
        {
          id: "q69",
          label: "Produces a single word to give directions (ex. go, up, down, stop, play, get, read, put).",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_6: 1.0,
          }
        },
        {
          id: "q6text",
          label: "Notes:",
          answer_block: 'free_response'
        },
      ]
    },
    {
      id: "stage_7",
      label: "Stage 7",
      border: [110, 186, 165],
      background: [188, 245, 229],
      questions: [
        {
          id: "q71",
          label: "Produces a total of four to ten different words (total number of words known in vocabulary/lexicon)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_7: 1.0,
          }
        },
        {
          id: "q7text",
          label: "Notes:",
          answer_block: 'free_response'
        },
      ]
    },
    {
      id: "stage_8",
      label: "Stage 8",
      border: [100, 179, 134],
      background: [171, 245, 203],
      questions: [
        {
          id: "q81",
          label: "Produces a total of 11 to 25 different words.",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_8: 1.0,
          }
        },
        {
          id: "q82",
          label: "Produces a single word to comment on a person, environment, or activity. (ex. good, bad, like, love)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_8: 1.0,
          }
        },
        {
          id: "q8text",
          label: "Notes:",
          answer_block: 'free_response'
        },
      ]
    },
    {
      id: "stage_9",
      label: "Stage 9",
      border: [83, 181, 108],
      background: [154, 230, 173],
      questions: [
        {
          id: "q91",
          label: "Produces a total of 26 to 50 different words.",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_9: 1.0,
          }
        },
        {
          id: "q92",
          label: "Produces at least two different single words to indicate location (ex. up, there, here, down, on, in)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_9: 1.0,
          }
        },
        {
          id: "q93",
          label: "Produces a variety of single words to ask a question (ex. go? where? mine? more?) ",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_9: 1.0,
          }
        },
        {
          id: "q94",
          label: "Produces a variety of single words to answer a question (ex. yes, no, here, there, it, mine, that, this)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_9: 1.0,
          }
        },
        {
          id: "q95",
          label: "Produces a variety of single words to make a request (ex. mine, want, help, go, finished, come, look)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_9: 1.0,
          }
        },
        {
          id: "q96",
          label: "Produces a variety of single words to label (ex. it, that, this, you, me) ",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_9: 1.0,
          }
        },
        {
          id: "q97",
          label: "Produces a variety of single words to indicate ownership (ex. mine, you, your, me)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_9: 1.0,
          }
        },
        {
          id: "q98",
          label: "Produces a variety of single words as a greeting",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_9: 1.0,
          }
        },
        {
          id: "q99",
          label: "Produces a variety of single words to protest (ex. no, stop, finished, mine)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_9: 1.0,
          }
        },
        {
          id: "q910",
          label: "Produces a variety of single words to give directions (ex. go, up, down, stop, play, get, read, put)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_9: 1.0,
          }
        },
        {
          id: "q911",
          label: "Produces a variety of single words to comment on a person, environment, or activity. (ex. good, bad, like, love)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_9: 1.0,
          }
        },
        {
          id: "q9text",
          label: "Notes:",
          answer_block: 'free_response'
        },
      ]
    },
    {
      id: "stage_10",
      label: "Stage 10",
      border: [84, 156, 89],
      background: [162, 224, 166],
      questions: [
        {
          id: "qa1",
          label: "Produces a total of more than 50 words.",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_10: 1.0,
          }
        },
        {
          id: "qa2",
          label: "Combines two words to indicate location (ex. up there, it in, it there, come here, she out)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_10: 1.0,
          }
        },
        {
          id: "qa3",
          label: "Combines two words to ask a question (ex. where go?, my turn?, I have?, eat this? drink it?)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_10: 1.0,
          }
        },
        {
          id: "qa4",
          label: "Combines two words to answer a question (ex. read more, go fast, its here)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_10: 1.0,
          }
        },
        {
          id: "qa5",
          label: "Combines two words to make a request (ex. want more, I have, go slow, you sit, watch me)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_10: 1.0,
          }
        },
        {
          id: "qa6",
          label: "Combines two words to label, comment, or describe (ex. that big, it fast, that bad, it good, red one, it blue).",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_10: 1.0,
          }
        },
        {
          id: "qa7",
          label: "Combines two words to indicate ownership (ex. it mine, my turn, it hers, it his)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_10: 1.0,
          }
        },
        {
          id: "qa8",
          label: "Combines two words to deny, reject, or protest (ex. no go, stop it, stop that, you stop, I finished, not me, not like, that bad, you bad) ",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_10: 1.0,
          }
        },
        {
          id: "qa9",
          label: "Combines two words to give directions (ex. put in, you up, go there, eat it, get that, go fast, slow down, you look)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_10: 1.0,
          }
        },
        {
          id: "qa10",
          label: "Uses the plural s",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_10: 1.0,
          }
        },
        {
          id: "qa11",
          label: "Uses present progressive verb forms - ing (ex. eating, finding, putting, making, looking, loving, helping, going, stopping, turning)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_10: 1.0,
          }
        },
        {
          id: "qa12",
          label: "Uses at least three pronouns (ex. I, you, me, my",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_10: 1.0,
          }
        },
        {
          id: "qa13",
          label: "Uses words to express quantity (ex. more, big, little, some, a lot, many, all)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_10: 1.0,
          }
        },
        {
          id: "qa14",
          label: "Uses phrases which changes the meaning of the individual words in that phrase (ie, phrasal verbs such as slow down, get out,  go on, I get it!)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_10: 1.0,
          }
        },
        {
          id: "qatext",
          label: "Notes:",
          answer_block: 'free_response'
        },
      ]
    },
    {
      id: "stage_11",
      label: "Stage 11",
      border: [84, 156, 89],
      background: [162, 224, 166],
      questions: [
        {
          id: "qb1",
          label: "Combines three or more words to indicate location (ex.go up there, it is in, it is there, you come here, she goes out)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_11: 1.0,
          }
        },
        {
          id: "qb2",
          label: "Combines three or more words to ask a question (ex. where it go?, it is my turn?, Can I have?, you eat this? Can I drink it?)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_11: 1.0,
          }
        },
        {
          id: "qb3",
          label: "Combines three or more words to answer a question (ex. I read more, it goes fast, it is here)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_11: 1.0,
          }
        },
        {
          id: "qb4",
          label: "Combines three or more words to make a request (ex. I want more, I have it, I go slow, I sit there, watch me do it)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_11: 1.0,
          }
        },
        {
          id: "qb5",
          label: "Combines three or more words to label, comment, or describe (ex. that is big, it is fast, that is bad, it is good, that red one, it is blue)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_11: 1.0,
          }
        },
        {
          id: "qb6",
          label: "Combines three or more words to indicate ownership (ex. it is mine, it is my turn, this is hers, that is his)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_11: 1.0,
          }
        },
        {
          id: "qb7",
          label: "Combines three or more words to deny, reject, or protest (ex. do not go, you stop it, stop that please, you stop that, I finished it, it is not mine, do not like it, that is bad, you are bad) ",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_11: 1.0,
          }
        },
        {
          id: "qb8",
          label: "Combines three or more words to give directions (ex. put it in, you go up, you go there, you eat it, you get that, go there fast, slow it down, you look at it)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_11: 1.0,
          }
        },
        {
          id: "qb9",
          label: "Uses two irregular past tense verbs (ex. went, came, heard, felt, did, saw, got, said, thought, made, took, knew)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_11: 1.0,
          }
        },
        {
          id: "qb10",
          label: "Uses the possessive s ('s) (ex. his, hers, yours, ours, theirs)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_11: 1.0,
          }
        },
        {
          id: "qb11",
          label: "Uses \"is\" and \"are\" as the main verb (ex. It is there, where is it?, there it is, he is fast, she is big)",
          answer_block: "frequency",
          score_categories: {
            cole: 1.0,
            stage_11: 1.0,
          }
        },
        {
          id: "qbtext",
          label: "Notes:",
          answer_block: 'free_response'
        },
      ]
    },
  ],
  report_segments: [
    {
      type: "score",
      score_category: "cole",
      summary: true,
    },
    {
      type: "weights",
      score_categories: ["stage_1", "stage_2", "stage_3", "stage_4", "stage_5", "stage_6", "stage_7", "stage_8", "stage_9", "stage_10", "stage_11"]
    },
    {
      type: "raw",
    }
  ]
};

export default profiles;

