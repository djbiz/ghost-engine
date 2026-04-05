// momentum-controller.js — Ghost Engine Momentum System
// Implements: SURGE, STACK, SPIKE, DRY commands from COMMAND-LAYER.md

const fs = require('fs');
const path = require('path');

const MOMENTUM_STATES = {
  SURGE: { label: 'SURGE Mode', multiplier: 2.0, description: 'Double outreach volume, extend hours' },
  STACK: { label: 'STACK Mode', multiplier: 1.5, description: 'Layer offers on warm leads' },
  SPIKE: { label: 'SPIKE Mode', multiplier: 3.0, description: 'All-in push for 24-48 hours' },
  DRY: { label: 'DRY Mode', multiplier: 0.5, description: 'Conserve energy, focus on closes only' },
  NORMAL: { label: 'Normal', multiplier: 1.0, description: 'Standard operating rhythm' }
};

class MomentumController {
  constructor() {
    this.currentState = 'NORMAL';
    this.stateHistory = [];
    this.activeSince = new Date();
  }

  setState(command) {
    if (!MOMENTUM_STATES[command]) {
      throw new Error(`Unknown momentum command: ${command}`);
    }
    const prev = this.currentState;
    this.currentState = command;
    this.activeSince = new Date();
    this.stateHistory.push({ from: prev, to: command, timestamp: new Date().toISOString() });
    console.log(`[Zo] Momentum: ${MOMENTUM_STATES[prev].label} \u2192 ${MOMENTUM_STATES[command].label}`);
    return this.getStatus();
  }

  getStatus() {
    const state = MOMENTUM_STATES[this.currentState];
    return {
      current: this.currentState,
      label: state.label,
      multiplier: state.multiplier,
      description: state.description,
      activeSince: this.activeSince.toISOString(),
      history: this.stateHistory.slice(-10)
    };
  }

  getOutreachMultiplier() {
    return MOMENTUM_STATES[this.currentState].multiplier;
  }

  shouldDoubleDown() {
    return ['SURGE', 'SPIKE'].includes(this.currentState);
  }

  shouldConserve() {
    return this.currentState === 'DRY';
  }

  autoAdjust(metrics) {
    const { dailyCloses, pipelineValue, responseRate } = metrics;
    if (dailyCloses >= 3) return this.setState('STACK');
    if (pipelineValue > 20000 && responseRate > 0.15) return this.setState('SURGE');
    if (responseRate < 0.05) return this.setState('DRY');
    return this.getStatus();
  }
}

module.exports = { MomentumController, MOMENTUM_STATES };
