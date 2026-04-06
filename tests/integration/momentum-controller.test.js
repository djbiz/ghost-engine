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

  describe('Momentum States', () => {
    it('should define exactly 5 momentum states', () => {
      const states = Object.keys(MOMENTUM_STATES);
      expect(states).toHaveLength(5);
    });

    it('should include SURGE state', () => {
      expect(MOMENTUM_STATES.SURGE).toBe('SURGE');
    });

    it('should include STACK state', () => {
      expect(MOMENTUM_STATES.STACK).toBe('STACK');
    });

    it('should include SPIKE state', () => {
      expect(MOMENTUM_STATES.SPIKE).toBe('SPIKE');
    });

    it('should include DRY state', () => {
      expect(MOMENTUM_STATES.DRY).toBe('DRY');
    });

    it('should include NORMAL state', () => {
      expect(MOMENTUM_STATES.NORMAL).toBe('NORMAL');
    });

    it('should initialize with NORMAL state', () => {
      expect(controller.getState()).toBe(MOMENTUM_STATES.NORMAL);
    });
  });

  describe('State Multipliers', () => {
    it('should map SURGE to 2.0x multiplier', () => {
      expect(STATE_MULTIPLIERS[MOMENTUM_STATES.SURGE]).toBe(2.0);
    });

    it('should map STACK to 1.5x multiplier', () => {
      expect(STATE_MULTIPLIERS[MOMENTUM_STATES.STACK]).toBe(1.5);
    });

    it('should map SPIKE to 1.75x multiplier', () => {
      expect(STATE_MULTIPLIERS[MOMENTUM_STATES.SPIKE]).toBe(1.75);
    });

    it('should map DRY to 0.5x multiplier', () => {
      expect(STATE_MULTIPLIERS[MOMENTUM_STATES.DRY]).toBe(0.5);
    });

    it('should map NORMAL to 1.0x multiplier', () => {
      expect(STATE_MULTIPLIERS[MOMENTUM_STATES.NORMAL]).toBe(1.0);
    });

    it('should scale outreach count by SURGE multiplier', () => {
      controller.setState(MOMENTUM_STATES.SURGE);
      const base = 10;
      const scaled = base * controller.getActiveMultiplier();
      expect(scaled).toBe(20);
    });

    it('should scale content frequency by STACK multiplier', () => {
      controller.setState(MOMENTUM_STATES.STACK);
      const base = 4;
      const scaled = base * controller.getActiveMultiplier();
      expect(scaled).toBe(6);
    });

    it('should scale follow-up urgency by SPIKE multiplier', () => {
      controller.setState(MOMENTUM_STATES.SPIKE);
      const base = 8;
      const scaled = base * controller.getActiveMultiplier();
      expect(scaled).toBe(14);
    });

    it('should reduce activity by DRY multiplier', () => {
      controller.setState(MOMENTUM_STATES.DRY);
      const base = 10;
      const scaled = base * controller.getActiveMultiplier();
      expect(scaled).toBe(5);
    });
  });

  describe('Auto-Adjust Logic', () => {
    it('should transition to SURGE when leads and closes are high', () => {
      controller.autoAdjust({ leads: 100, closes: 80, activity: 90 });
      expect(controller.getState()).toBe(MOMENTUM_STATES.SURGE);
    });

    it('should transition to STACK when pipeline is consistent', () => {
      controller.autoAdjust({ leads: 60, closes: 40, activity: 70 });
      expect(controller.getState()).toBe(MOMENTUM_STATES.STACK);
    });

    it('should transition to SPIKE when viral content is detected', () => {
      controller.autoAdjust({ leads: 50, closes: 20, activity: 100, viralContent: true });
      expect(controller.getState()).toBe(MOMENTUM_STATES.SPIKE);
    });

    it('should transition to DRY when activity is low', () => {
      controller.autoAdjust({ leads: 5, closes: 0, activity: 10 });
      expect(controller.getState()).toBe(MOMENTUM_STATES.DRY);
    });

    it('should stay NORMAL when metrics are moderate', () => {
      controller.autoAdjust({ leads: 30, closes: 15, activity: 40 });
      expect(controller.getState()).toBe(MOMENTUM_STATES.NORMAL);
    });

    it('should update multiplier after auto-adjust to SURGE', () => {
      controller.autoAdjust({ leads: 100, closes: 80, activity: 90 });
      expect(controller.getActiveMultiplier()).toBe(2.0);
    });

    it('should update multiplier after auto-adjust to DRY', () => {
      controller.autoAdjust({ leads: 5, closes: 0, activity: 10 });
      expect(controller.getActiveMultiplier()).toBe(0.5);
    });
  });

  describe('State Transitions', () => {
    it('should transition from NORMAL to SURGE', () => {
      controller.setState(MOMENTUM_STATES.SURGE);
      expect(controller.getState()).toBe(MOMENTUM_STATES.SURGE);
    });

    it('should transition from NORMAL to STACK', () => {
      controller.setState(MOMENTUM_STATES.STACK);
      expect(controller.getState()).toBe(MOMENTUM_STATES.STACK);
    });

    it('should transition from NORMAL to SPIKE', () => {
      controller.setState(MOMENTUM_STATES.SPIKE);
      expect(controller.getState()).toBe(MOMENTUM_STATES.SPIKE);
    });

    it('should transition from NORMAL to DRY', () => {
      controller.setState(MOMENTUM_STATES.DRY);
      expect(controller.getState()).toBe(MOMENTUM_STATES.DRY);
    });

    it('should transition from SURGE to DRY (extreme edge case)', () => {
      controller.setState(MOMENTUM_STATES.SURGE);
      controller.setState(MOMENTUM_STATES.DRY);
      expect(controller.getState()).toBe(MOMENTUM_STATES.DRY);
    });

    it('should transition from DRY to SURGE (recovery)', () => {
      controller.setState(MOMENTUM_STATES.DRY);
      controller.setState(MOMENTUM_STATES.SURGE);
      expect(controller.getState()).toBe(MOMENTUM_STATES.SURGE);
    });

    it('should update multiplier on transition to STACK', () => {
      controller.setState(MOMENTUM_STATES.STACK);
      expect(controller.getActiveMultiplier()).toBe(1.5);
    });

    it('should update multiplier on transition to SPIKE', () => {
      controller.setState(MOMENTUM_STATES.SPIKE);
      expect(controller.getActiveMultiplier()).toBe(1.75);
    });

    it('should log transition in history', () => {
      controller.setState(MOMENTUM_STATES.SURGE);
      const history = controller.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(1);
    });

    it('should include timestamp in history entry', () => {
      controller.setState(MOMENTUM_STATES.SURGE);
      const history = controller.getHistory();
      const lastEntry = history[history.length - 1];
      expect(lastEntry).toHaveProperty('timestamp');
    });

    it('should record from-state and to-state in history', () => {
      controller.setState(MOMENTUM_STATES.SURGE);
      const history = controller.getHistory();
      const lastEntry = history[history.length - 1];
      expect(lastEntry.from).toBe(MOMENTUM_STATES.NORMAL);
      expect(lastEntry.to).toBe(MOMENTUM_STATES.SURGE);
    });

    it('should accumulate multiple transitions in history', () => {
      controller.setState(MOMENTUM_STATES.SURGE);
      controller.setState(MOMENTUM_STATES.STACK);
      controller.setState(MOMENTUM_STATES.NORMAL);
      const history = controller.getHistory();
      expect(history).toHaveLength(3);
    });
  });

  describe('Edge Cases -- Rapid State Cycling', () => {
    it('should handle NORMAL->SURGE->DRY->NORMAL rapid transitions maintaining correct final state', () => {
      expect(controller.getState()).toBe(MOMENTUM_STATES.NORMAL);
      controller.setState(MOMENTUM_STATES.SURGE);
      controller.setState(MOMENTUM_STATES.DRY);
      controller.setState(MOMENTUM_STATES.NORMAL);
      expect(controller.getState()).toBe(MOMENTUM_STATES.NORMAL);
    });

    it('should accumulate correct history length during rapid cycling', () => {
      controller.setState(MOMENTUM_STATES.SURGE);
      controller.setState(MOMENTUM_STATES.DRY);
      controller.setState(MOMENTUM_STATES.NORMAL);
      controller.setState(MOMENTUM_STATES.SPIKE);
      controller.setState(MOMENTUM_STATES.STACK);
      const history = controller.getHistory();
      expect(history).toHaveLength(5);
    });

    it('should apply correct multiplier after rapid cycling settles', () => {
      controller.setState(MOMENTUM_STATES.SURGE);
      controller.setState(MOMENTUM_STATES.DRY);
      controller.setState(MOMENTUM_STATES.SPIKE);
      controller.setState(MOMENTUM_STATES.STACK);
      expect(controller.getActiveMultiplier()).toBe(STATE_MULTIPLIERS[MOMENTUM_STATES.STACK]);
      expect(controller.getActiveMultiplier()).toBe(1.5);
    });
  });

  describe('Edge Cases -- Boundary Thresholds', () => {
    it('should stay NORMAL when leads=80 and closes=74 (just below SURGE threshold)', () => {
      controller.autoAdjust({ leads: 80, closes: 74, activity: 70 });
      expect(controller.getState()).not.toBe(MOMENTUM_STATES.SURGE);
    });

    it('should transition to SURGE when leads=80 and closes=75 (exact boundary)', () => {
      controller.autoAdjust({ leads: 80, closes: 75, activity: 80 });
      expect(controller.getState()).toBe(MOMENTUM_STATES.SURGE);
    });

    it('should stay NORMAL when activity=20 (just above DRY threshold)', () => {
      controller.autoAdjust({ leads: 30, closes: 15, activity: 20 });
      expect(controller.getState()).not.toBe(MOMENTUM_STATES.DRY);
    });

    it('should transition to DRY when activity=19 (just below DRY threshold)', () => {
      controller.autoAdjust({ leads: 5, closes: 0, activity: 19 });
      expect(controller.getState()).toBe(MOMENTUM_STATES.DRY);
    });
  });

  describe('Edge Cases -- Multiplier Application', () => {
    it('should return 0 when multiplier applied to zero-value input', () => {
      controller.setState(MOMENTUM_STATES.SURGE);
      const result = 0 * controller.getActiveMultiplier();
      expect(result).toBe(0);
    });

    it('should handle fractional results from multiplier application', () => {
      controller.setState(MOMENTUM_STATES.SPIKE);
      const result = 3 * controller.getActiveMultiplier();
      expect(result).toBe(5.25);
    });

    it('should apply DRY 0.5x to odd numbers correctly (e.g. 7*0.5=3.5)', () => {
      controller.setState(MOMENTUM_STATES.DRY);
      const result = 7 * controller.getActiveMultiplier();
      expect(result).toBe(3.5);
    });

    it('should apply SURGE 2.0x to large numbers without overflow', () => {
      controller.setState(MOMENTUM_STATES.SURGE);
      const largeValue = 1000000;
      const result = largeValue * controller.getActiveMultiplier();
      expect(result).toBe(2000000);
      expect(Number.isFinite(result)).toBe(true);
    });
  });

  describe('Edge Cases -- Invalid State Handling', () => {
    it('should reject setState with undefined', () => {
      expect(() => controller.setState(undefined)).toThrow();
    });

    it('should reject setState with empty string', () => {
      expect(() => controller.setState('')).toThrow();
    });

    it('should reject setState with numeric value', () => {
      expect(() => controller.setState(42)).toThrow();
    });
  });

  describe('Edge Cases -- getActiveMultiplier Consistency', () => {
    it('should return 2.0 after setState to SURGE', () => {
      controller.setState(MOMENTUM_STATES.SURGE);
      expect(controller.getActiveMultiplier()).toBe(2.0);
    });

    it('should return 1.5 after setState to STACK', () => {
      controller.setState(MOMENTUM_STATES.STACK);
      expect(controller.getActiveMultiplier()).toBe(1.5);
    });

    it('should return 1.75 after setState to SPIKE', () => {
      controller.setState(MOMENTUM_STATES.SPIKE);
      expect(controller.getActiveMultiplier()).toBe(1.75);
    });

    it('should return 0.5 after setState to DRY', () => {
      controller.setState(MOMENTUM_STATES.DRY);
      expect(controller.getActiveMultiplier()).toBe(0.5);
    });

    it('should return 1.0 after setState to NORMAL', () => {
      controller.setState(MOMENTUM_STATES.NORMAL);
      expect(controller.getActiveMultiplier()).toBe(1.0);
    });
  });

  describe('Edge Cases -- History Management', () => {
    it('should return empty array for fresh controller with no transitions', () => {
      const fresh = new MomentumController();
      const history = fresh.getHistory();
      expect(Array.isArray(history)).toBe(true);
      expect(history).toHaveLength(0);
    });

    it('should maintain chronological order in transition history', () => {
      controller.setState(MOMENTUM_STATES.SURGE);
      controller.setState(MOMENTUM_STATES.DRY);
      controller.setState(MOMENTUM_STATES.NORMAL);
      const history = controller.getHistory();
      for (let i = 1; i < history.length; i++) {
        const prev = new Date(history[i - 1].timestamp).getTime();
        const curr = new Date(history[i].timestamp).getTime();
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    });
  });
});
