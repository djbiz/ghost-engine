'use strict';

var fs = require('fs');
var path = require('path');

var IDEMPOTENCY_LOG_PATH = path.join(__dirname, '..', 'data', 'idempotency-log.json');
var STATE_VERSIONS_PATH = path.join(__dirname, '..', 'data', 'state-versions.json');

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return {};
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function wasAlreadyProcessed(idempotencyKey) {
  var log = readJSON(IDEMPOTENCY_LOG_PATH);
  return !!log[idempotencyKey];
}

function markProcessed(idempotencyKey, activityName) {
  var log = readJSON(IDEMPOTENCY_LOG_PATH);
  log[idempotencyKey] = { activityName: activityName, processedAt: new Date().toISOString() };
  writeJSON(IDEMPOTENCY_LOG_PATH, log);
}

function getStateVersion(stateKey) {
  var versions = readJSON(STATE_VERSIONS_PATH);
  return versions[stateKey] || 0;
}

function checkAndBumpVersion(stateKey, expectedVersion) {
  var versions = readJSON(STATE_VERSIONS_PATH);
  var current = versions[stateKey] || 0;
  if (current !== expectedVersion) {
    throw new Error('State version conflict for "' + stateKey + '": expected ' + expectedVersion + ', got ' + current);
  }
  versions[stateKey] = current + 1;
  writeJSON(STATE_VERSIONS_PATH, versions);
  return current + 1;
}

module.exports = {
  wasAlreadyProcessed: wasAlreadyProcessed,
  markProcessed: markProcessed,
  getStateVersion: getStateVersion,
  checkAndBumpVersion: checkAndBumpVersion
};
