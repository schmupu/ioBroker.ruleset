'use strict';

var utils = require(__dirname + '/lib/utils'); // Get common adapter utils
var dp = require(__dirname + '/lib/datapoints');
var rulesset = require(__dirname + '/lib/rules');
var net = require('net');
var adapter = new utils.Adapter('ruleset');
var vm = require('vm');
var rules = null;
var request = require("request");
var sched = require("node-schedule");

// *****************************************************************************************************
// is called when adapter shuts down - callback has to be called under any circumstances!
// *****************************************************************************************************
adapter.on('unload', (callback) => {
  try {
    adapter.log.info('Closing Adapter');
    callback();
  } catch (e) {
    // adapter.log.error('Error');
    callback();
  }
});


// *****************************************************************************************************
// Listen for sendTo messages
// *****************************************************************************************************
adapter.on('message', (msg) => {

  let command = msg.command;
  let parameter = msg.message;
  let callback = msg.callback;
  let id = msg._id;

  switch (command) {
    case 'add':
      rules.addRule(parameter);
      break;
    case 'delete':
      rules.deleteRule(parameter);
      break;
    case 'modify':
      rules.modifyRule(parameter);
      break;
    case 'holiday':
      rules.setFeiertage(parameter);
      break;
    default:
      break;
  }

  let r = rules.getRules();
  saveRulesSet(r);

  rules.executeRules((values) => {
    if (values) {
      adapter.log.debug(JSON.stringify(values));
    } else {
      adapter.log.error("Error by executing rules");
    }
  });

});


// *****************************************************************************************************
// is called when databases are connected and adapter received configuration.
// start here!
// *****************************************************************************************************
adapter.on('ready', () => {
  main();
});

// *****************************************************************************************************
// Read holidays
// *****************************************************************************************************

function getFeiertag(state, callback, year) {

  if (state) {
    if (!year) year = (new Date()).getFullYear();
    let url = "https://ipty.de/feiertag/api.php?do=getFeiertage&loc=" + state + "&jahr=" + year + "&outformat=Y-m-d";
    request({ url: url }, function (error, response, body) {
      if (body) {
        let result = JSON.parse(body);
        callback && callback(result);
      } else {
        callback && callback();
      }
    });
  }

}


// *****************************************************************************************************
// Save Holidays
// *****************************************************************************************************
function saveHolidays(holiday) {
  if (holiday) {
    let id = "config.holiday";
    holiday = JSON.stringify(holiday);
    adapter.log.info("Saving Holidays");
    adapter.setState(id, holiday, true, function (err) {
      if (!err) {
        adapter.log.info("Saving Holidays successfull");
      }
    });
  }
}


// *****************************************************************************************************
// Relgelwerg speichern
// *****************************************************************************************************
function loadHoliday(callback) {
  let id = "config.holiday";
  adapter.log.info("Loading Holidays");
  adapter.getState(id, function (err, state) {
    if (!err && state && state.val) {
      state = JSON.parse(state.val);
      callback && callback(state || []);
    } else {
      callback && callback([]);
    }
  });
}


// *****************************************************************************************************
// Relgelwerg speichern
// *****************************************************************************************************
function saveRulesSetOld(ruleset) {
  if (ruleset) {
    let id = "config.ruleset";
    ruleset = JSON.stringify(ruleset);
    adapter.log.info("Saving Ruleset");
    adapter.setState(id, ruleset, true, function (err) {
      if (!err) {
        adapter.log.info("Saving Ruleset successfull");
      }
    });
  }
}


// *****************************************************************************************************
// Relgelwerg speichern
// *****************************************************************************************************
function loadRulesSetOld(callback) {
  let id = "config.ruleset";
  adapter.log.info("Loading Ruleset");
  adapter.getState(id, function (err, state) {
    if (!err && state && state.val) {
      state = JSON.parse(state.val);
      callback && callback(state || []);
    } else {
      callback && callback([]);
    }
  });
}

// *****************************************************************************************************
// Relgelwerg speichern
// *****************************************************************************************************
function saveRulesSet(ruleset) {
  if (ruleset) {
    let id = "system.adapter." + adapter.namespace;
    adapter.getForeignObject(id, function (err, obj) {
      obj.native.ruleset = ruleset;
      adapter.setForeignObject(id, obj, function (err) {
      });
    });
  }
}

// *****************************************************************************************************
// Relgelwerg speichern
// *****************************************************************************************************
function loadRulesSet(callback) {
  let id = "system.adapter." + adapter.namespace;
  adapter.getForeignObject(id, function (err, obj) {
    if (!err) {
      callback && callback(obj.native.ruleset || []);
    } else {
      callback && callback([]);
    }
  });
}


// *****************************************************************************************************
// Main
// *****************************************************************************************************
function main() {
  rules = new rulesset(adapter);
  let cal = adapter.config.holiday || 'HH';
  let simulation = adapter.config.simulation || false;

  adapter.log.info("Starting Adapter");

  //Get every Jear new Hollidays
  sched.scheduleJob('1 0 * * *', function () {
    getFeiertag(cal, (holidays) => {
      adapter.log.info("Got new holidays!");
      //rules.setFeiertage(holidays);
      //saveHolidays(holidays);
    });
  });


  // on every Start get Holidays
  getFeiertag(cal, (holidays) => {
    adapter.log.info("Got new holidays");
    //rules.setFeiertage(holidays);
    //saveHolidays(holidays);
  });


  loadRulesSet((r) => {
    rules.modifyRules(r);
    rules.executeRules((values) => {
      if (values) {
        adapter.log.debug(JSON.stringify(values));
      } else {
        adapter.log.error("Error by executing rules");
      }
    });
  });


  setInterval(() => {
    rules.executeRules((values) => {
      if (values) {
        adapter.log.debug(JSON.stringify(values));
      } else {
        adapter.log.error("Error by executing rules");
      }
    })
  }, adapter.config.pollInterval * 1000);

}