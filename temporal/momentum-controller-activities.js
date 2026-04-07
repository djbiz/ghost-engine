'use strict';

var idempotencyUtils = require('./idempotency-utils');

const fs = require('fs');
const path = require('path');

/**
 * Momentum states and their multipliers
 */
const MOMENTUM_STATES = {
  SURGE:  { multiplier: 2.0,  description: 'Full surge - leads and closes firing on all cylinders' },
  STACK:  { multiplier: 1.5,  description: 'Pipeline stacking - strong pipeline health' },
  SPIKE:  { multiplier: 1.75, description: 'Viral spike - content going viral' },
  DRY:    { multiplier: 0.5,  description: 'Dry spell - low activity, conserve resources' },
  NORMAL: { multiplier: 1.0,  description: 'Normal operations - steady state' },
};

/**
 * Factory: createMomentumControllerActivities(config)
 * Returns { runMomentumAdjust }
 */
function createMomentumControllerActivities(config = {}) {
  const dataDir = config.dataDir || path.resolve(__dirname, '..', 'data');
  const stateFile = path.join(dataDir, 'momentum-state.json');

  function ensureDataDir() {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  function loadState() {
    ensureDataDir();
    if (fs.existsSync(stateFile)) {
      const raw = fs.readFileSync(stateFile, 'utf-8');
      return JSON.parse(raw);
    }
    return { current: 'NORMAL', history: [] };
  }

  function saveState(state) {
    ensureDataDir();
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf-8');
  }

  /**
   * Evaluate pipeline metrics and determine momentum state.
   *
   * Trigger rules (evaluated in priority order):
   *   leads >= 80 AND closes >= 75 -> SURGE  (2.0x)
   *   viralContent is truthy        -> SPKKE  (1.75x)
   *   pipelineHealth >= 80          -> STACK  (1.5x)
   *   activityLevel < 20            -> DRY    (0.5x)
   *   otherwise                     -> NORMAL (1.0x)
   */
  function determineMomentumState(metrics) {
    const { leads = 0, closes = 0, pipelineHealth = 0, viralContent = false, activityLevel = 50 } = metrics;

    if (leads >= 80 && closes >= 75) return 'SURGE';
    if (viralContent) return 'SPIKE';
    if (pipelineHealth >= 80) return 'STACK';
    if (activityLevel < 20) return 'DRY';
    return 'NORMAL';
  }

  async function runMomentumAdjust(input) {
    var opts = arguments[arguments.length - 1] && typeof arguments[arguments.length - 1] === 'object' && arguments[arguments.length - 1].__idempotency ? arguments[arguments.length - 1] : {};
    if (opts.idempotencyKey && idempotencyUtils.wasAlreadyProcessed(opts.idempotencyKey)) {
      console.log('[SKIP] runMomentumAdjust already processed for key: ' + opts.idempotencyKey);
      return { skipped: true, reason: 'duplicate', idempotencyKey: opts.idempotencyKey };
    }
    if (typeof opts.expectedStateVersion === 'number') {
      idempotencyUtils.checkAndBumpVersion('runMomentumAdjust', opts.expectedStateVersion);
    }

    const { date, metrics } = input;
    const state = loadState();
    const previousState = state.current;
    const newState = determineMomentumState(metrics);
    const stateInfo = MOMENTUM_STATES[newState];

    const transition = {
      date,
      timestamp: new Date().toISOString(),
      from: previousState,
      to: newState,
      multiplier: stateInfo.multiplier,
      description: stateInfo.description,
      metrics: { ...metrics },
      changed: previousState !== newState,
    };

    state.current = newState;
    state.multiplier = stateInfo.multiplier;
    state.lastEvaluated = transition.timestamp;
    state.lastMetrics = { ...metrics };
    state.history.push(transition);

    // Keep history bounded (last 90 entries)
    if (state.history.length > 90) {
      state.history = state.history.slice(-90);
    }

    saveState(state);

    if (opts.idempotencyKey) { idempotencyUtils.markProcessed(opts.idempotencyKey, 'runMomentumAdjust'); }

    return {
      date,
      previousState,
      currentState: newState,
      multiplier: stateInfo.multiplier,
      description: stateInfo.description,
      changed: transition.changed,
      metrics,
      historyLength: state.history.length,
    };
  }

  return { runMomentumAdjust };
}

module.exports = { createMomentumControllerActivities, MOMENTUM_STATES };
