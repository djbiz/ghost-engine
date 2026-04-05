'use strict';

const {
  MomentumController,
  MOMENTUM_STATES,
  STATE_MULTIPLIERS
} = require('../../scripts/momentum-controller');

describe('MomentumController', () => {
  let controller;

  beforeEach(() => {
    controller = new MomentumController();
  });

  // -------------------------------------------------------
  // 1. Momentum States
  // -------------------------------------------------------
  describe('Momentum States', () => {
    it('should define exactly five momentum states', () => {
      const states = Object.keys(MOMENTUM_STATES);
      expect(states).toHaveLength(5);
    });

    it('should include SURGE as a valid state', () => {
      expect(MOMENTUM_STATES.SURGE).toBe('SURGE');
    });

    it('should include STACK as a valid state', () => {
      expect(MOMENTUM_STATES.STACK).toBe('STACK');
    });

    it('should include SPIKE as a valid state', () => {
      expect(MOMENTUM_STATES.SPIKE).toBe('SPIKE');
    });

    it('should include DRY as a valid state', () => {
      expect(MOMENTUM_STATES.DRY).toBe('DRY');
    });

    it('should include NORMAL as a valid state', () => {
      expect(MOMENTUM_STATES.NORMAL).toBe('NORMAL');
    });

    it('should initialize the controller in NORMAL state', () => {
      expect(controller.getCurrentState()).toBe(MOMENTUM_STATES.NORMAL);
    });
  });

  // -------------------------------------------------------
  // 2. State Multipliers
  // -------------------------------------------------------
  describe('State Multipliers', () => {
    it('should assign a 2.0x multiplier to SURGE', () => {
      expect(STATE_MULTIPLIERS[MOMENTUM_STATES.SURGE]).toBe(2.0);
    });

    it('should assign a 1.5x multiplier to STACK', () => {
      expect(STATE_MULTIPLIERS[MOMENTUM_STATES.STACK]).toBe(1.5);
    });

    it('should assign a 1.75x multiplier to SPIKE', () => {
      expect(STATE_MULTIPLIERS[MOMENTUM_STATES.SPIKE]).toBe(1.75);
    });

    it('should assign a 0.5x multiplier to DRY', () => {
      expect(STATE_MULTIPLIERS[MOMENTUM_STATES.DRY]).toBe(0.5);
    });

    it('should assign a 1.0x multiplier to NORMAL', () => {
      expect(STATE_MULTIPLIERS[MOMENTUM_STATES.NORMAL]).toBe(1.0);
    });

    it('should scale outreach counts by the active multiplier', () => {
      const baseOutreach = 10;
      controller.setState(MOMENTUM_STATES.SURGE);
      const scaled = controller.applyMultiplier(baseOutreach, 'outreach');
      expect(scaled).toBe(baseOutreach * 2.0);
    });

    it('should scale content frequency by the active multiplier', () => {
      const baseFrequency = 4;
      controller.setState(MOMENTUM_STATES.STACK);
      const scaled = controller.applyMultiplier(baseFrequency, 'contentFrequency');
      expect(scaled).toBe(baseFrequency * 1.5);
    });

    it('should scale follow-up urgency by the active multiplier', () => {
      const baseUrgency = 8;
      controller.setState(MOMENTUM_STATES.SPIKE);
      const scaled = controller.applyMultiplier(baseUrgency, 'followUpUrgency');
      expect(scaled).toBe(baseUrgency * 1.75);
    });

    it('should halve metrics when in DRY state', () => {
      const baseOutreach = 20;
      controller.setState(MOMENTUM_STATES.DRY);
      const scaled = controller.applyMultiplier(baseOutreach, 'outreach');
      expect(scaled).toBe(10);
    });
  });

  // -------------------------------------------------------
  // 3. Auto-Adjust Logic
  // -------------------------------------------------------
  describe('Auto-Adjust Logic', () => {
    it('should transition to SURGE when leads and closes are both high', () => {
      controller.autoAdjust({ leads: 95, closes: 90, pipeline: 50, viralContent: false, activity: 80 });
      expect(controller.getCurrentState()).toBe(MOMENTUM_STATES.SURGE);
    });

    it('should transition to STACK when pipeline is consistently strong', () => {
      controller.autoAdjust({ leads: 60, closes: 55, pipeline: 85, viralContent: false, activity: 70 });
      expect(controller.getCurrentState()).toBe(MOMENTUM_STATES.STACK);
    });

    it('should transition to SPIKE when viral content is detected', () => {
      controller.autoAdjust({ leads: 50, closes: 40, pipeline: 50, viralContent: true, activity: 60 });
      expect(controller.getCurrentState()).toBe(MOMENTUM_STATES.SPIKE);
    });

    it('should transition to DRY when activity drops below threshold', () => {
      controller.autoAdjust({ leads: 5, closes: 2, pipeline: 10, viralContent: false, activity: 10 });
      expect(controller.getCurrentState()).toBe(MOMENTUM_STATES.DRY);
    });

    it('should remain NORMAL when metrics are at baseline', () => {
      controller.autoAdjust({ leads: 40, closes: 35, pipeline: 40, viralContent: false, activity: 50 });
      expect(controller.getCurrentState()).toBe(MOMENTUM_STATES.NORMAL);
    });

    it('should respect threshold boundaries for SURGE detection', () => {
      controller.autoAdjust({ leads: 79, closes: 74, pipeline: 50, viralContent: false, activity: 70 });
      expect(controller.getCurrentState()).not.toBe(MOMENTUM_STATES.SURGE);
    });

    it('should update the multiplier after auto-adjust changes state', () => {
      controller.autoAdjust({ leads: 95, closes: 90, pipeline: 50, viralContent: false, activity: 80 });
      expect(controller.getActiveMultiplier()).toBe(2.0);
    });
  });

  // -------------------------------------------------------
  // 4. State Transitions
  // -------------------------------------------------------
  describe('State Transitions', () => {
    it('should allow transition from NORMAL to SURGE', () => {
      const result = controller.setState(MOMENTUM_STATES.SURGE);
      expect(result).toBe(true);
      expect(controller.getCurrentState()).toBe(MOMENTUM_STATES.SURGE);
    });

    it('should allow transition from NORMAL to DRY', () => {
      const result = controller.setState(MOMENTUM_STATES.DRY);
      expect(result).toBe(true);
      expect(controller.getCurrentState()).toBe(MOMENTUM_STATES.DRY);
    });

    it('should allow transition from SURGE to DRY (edge case)', () => {
      controller.setState(MOMENTUM_STATES.SURGE);
      const result = controller.setState(MOMENTUM_STATES.DRY);
      expect(result).toBe(true);
      expect(controller.getCurrentState()).toBe(MOMENTUM_STATES.DRY);
    });

    it('should allow transition from DRY to SURGE (edge case)', () => {
      controller.setState(MOMENTUM_STATES.DRY);
      const result = controller.setState(MOMENTUM_STATES.SURGE);
      expect(result).toBe(true);
      expect(controller.getCurrentState()).toBe(MOMENTUM_STATES.SURGE);
    });

    it('should update the active multiplier after a transition', () => {
      controller.setState(MOMENTUM_STATES.STACK);
      expect(controller.getActiveMultiplier()).toBe(1.5);
      controller.setState(MOMENTUM_STATES.SPIKE);
      expect(controller.getActiveMultiplier()).toBe(1.75);
    });

    it('should log each transition in the transition history', () => {
      controller.setState(MOMENTUM_STATES.SURGE);
      controller.setState(MOMENTUM_STATES.STACK);
      const history = controller.getTransitionHistory();
      expect(history).toHaveLength(2);
    });

    it('should record from-state and to-state in history entries', () => {
      controller.setState(MOMENTUM_STATES.SPIKE);
      const history = controller.getTransitionHistory();
      const last = history[history.length - 1];
      expect(last.from).toBe(MOMENTUM_STATES.NORMAL);
      expect(last.to).toBe(MOMENTUM_STATES.SPIKE);
    });

    it('should include a timestamp in each history entry', () => {
      controller.setState(MOMENTUM_STATES.DRY);
      const history = controller.getTransitionHistory();
      expect(history[0]).toHaveProperty('timestamp');
      expect(typeof history[0].timestamp).toBe('number');
    });

    it('should preserve full history across multiple transitions', () => {
      controller.setState(MOMENTUM_STATES.SURGE);
      controller.setState(MOMENTUM_STATES.DRY);
      controller.setState(MOMENTUM_STATES.NORMAL);
      controller.setState(MOMENTUM_STATES.SPIKE);
      const history = controller.getTransitionHistory();
      expect(history).toHaveLength(4);
      expect(history[0].to).toBe(MOMENTUM_STATES.SURGE);
      expect(history[1].to).toBe(MOMENTUM_STATES.DRY);
      expect(history[2].to).toBe(MOMENTUM_STATES.NORMAL);
      expect(history[3].to).toBe(MOMENTUM_STATES.SPIKE);
    });

    it('should not create a history entry when transitioning to the same state', () => {
      controller.setState(MOMENTUM_STATES.NORMAL);
      const history = controller.getTransitionHistory();
      expect(history).toHaveLength(0);
    });

    it('should allow all valid state-to-state transitions', () => {
      const allStates = Object.values(MOMENTUM_STATES);
      for (const fromState of allStates) {
        for (const toState of allStates) {
          const c = new MomentumController();
          c.setState(fromState);
          const result = c.setState(toState);
          if (fromState !== toState) {
            expect(result).toBe(true);
            expect(c.getCurrentState()).toBe(toState);
          }
        }
      }
    });

    it('should accumulate correct history length over many transitions', () => {
      controller.setState(MOMENTUM_STATES.SURGE);
      controller.setState(MOMENTUM_STATES.STACK);
      controller.setState(MOMENTUM_STATES.SPIKE);
      controller.setState(MOMENTUM_STATES.DRY);
      controller.setState(MOMENTUM_STATES.NORMAL);
      const history = controller.getTransitionHistory();
      expect(history).toHaveLength(5);
      expect(history[4].from).toBe(MOMENTUM_STATES.DRY);
      expect(history[4].to).toBe(MOMENTUM_STATES.NORMAL);
    });
  });
});
