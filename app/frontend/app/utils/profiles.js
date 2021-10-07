import Ember from 'ember';
import EmberObject from '@ember/object';
import { observer } from '@ember/object';
import { computed } from '@ember/object';
import RSVP from 'rsvp';
import { htmlSafe } from '@ember/string';
import i18n from './i18n';

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
      list.push({
        id: group.id,
        header: true,
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
  reports_layout: computed('template.report_segments', 'template.score_categories', 'questions_layout', 'history', 'started_at', function() {
    var reports = this.get('template.report_segments') || [];
    var cats = this.get('template.score_categories') || {};
    var date = this.get('started_at');
    var history = this.get('history') || [];
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
            data.circle_style = htmlSafe("border-color: rgb(" + cats[report.score_category].border.map(function(n) { return parseInt(n, 10); }).join(', ') + ");");
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
          score_cat.prior_bar_style = "width: calc(" + (pct / 2) + "% - 4px); ";
          score_cat.prior_value = score_cat.value / 2;
          score_cat.prior_max = score_cat.max;

          if(cats[cat].border) {
            if(cats[cat].background) {
              score_cat.bar_style = score_cat.bar_style + htmlSafe("border-color: rgb(" + cats[cat].border.map(function(n) { return parseInt(n, 10); }).join(', ') + "); background: rgb(" + cats[cat].background.map(function(n) { return parseInt(n, 10); }).join(', ') + ");");
              score_cat.prior_bar_style = score_cat.prior_bar_style + htmlSafe("border-color: rgb(" + cats[cat].border.map(function(n) { return parseInt(n, 10); }).join(', ') + "); background: rgb(" + cats[cat].background.map(function(n) { return parseInt(n, 10); }).join(', ') + ");");
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
              bar_style: "width: calc(" + (pct / 2) + "% - 4px);",
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
          data.border_style = htmlSafe("border-color: rgb(" + report.border.map(function(n) { return parseInt(n, 10); }).join(', ') + ");");
        }
        (report.score_categories || []).forEach(function(cat) {
          data.scores.push(cats[cat].value || "?");
        });
        data.value = data.scores.join(report.join || '-');
        if(report.summary) {
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
      if(r.summary) {
        json.summary = json.summary || r.summary;
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
    if(id == 'sample') {
      return profiles.process(sample_profile);
    }
    return null;
  },
  process: function(json) {
    if(typeof(json) == 'string') {
      json = JSON.parse(json);
    }
    return Profile.create({template: json});
  }
};

export default profiles;
