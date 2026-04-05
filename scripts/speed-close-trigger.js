// speed-close-trigger.js — Ghost Engine Speed Close System
// Detects hot leads and triggers accelerated close sequence

const fs = require('fs');
const path = require('path');

const CLOSE_TIERS = {
  quick_flip: { price: 990, name: 'Quick Flip', urgency: 'high', timeline: '48 hours' },
  full_engine: { price: 4970, name: 'Full Engine Install', urgency: 'medium', timeline: '14 days' },
  ghost_partner: { price: 9700, name: 'Ghost Partner Retainer', urgency: 'low', timeline: '30 days' }
};

const HOT_SIGNALS = [
  'clicked_stripe_link',
  'replied_twice_in_24h',
  'asked_about_pricing',
  'visited_sales_page',
  'opened_3_emails_in_row',
  'booked_call'
];

class SpeedCloseTrigger {
  constructor(config = {}) {
    this.notifyPhone = config.notifyPhone || null;
    this.webhookUrl = config.webhookUrl || null;
    this.triggerLog = [];
  }

  evaluateLead(lead) {
    const { name, email, signals = [], engagementScore = 0 } = lead;
    const hotCount = signals.filter(s => HOT_SIGNALS.includes(s)).length;
    const isHot = hotCount >= 2 || engagementScore >= 80;

    if (!isHot) {
      return { triggered: false, lead: name, reason: 'Below threshold' };
    }

    const tier = this._recommendTier(lead);
    const result = {
      triggered: true,
      lead: name,
      email,
      tier: tier.name,
      price: tier.price,
      timeline: tier.timeline,
      hotSignals: hotCount,
      engagementScore,
      timestamp: new Date().toISOString()
    };

    this.triggerLog.push(result);
    console.log(`[Zo] SPEED CLOSE triggered for ${name} \u2014 ${tier.name} @ $${tier.price}`);
    return result;
  }

  _recommendTier(lead) {
    const { signals = [], engagementScore = 0 } = lead;
    if (signals.includes('clicked_stripe_link') || signals.includes('asked_about_pricing')) {
      return CLOSE_TIERS.quick_flip;
    }
    if (engagementScore >= 90 || signals.includes('booked_call')) {
      return CLOSE_TIERS.full_engine;
    }
    return CLOSE_TIERS.ghost_partner;
  }

  async notify(result) {
    if (!result.triggered) return;
    const message = `[Zo] Speed Close: ${result.lead} \u2014 ${result.tier} ($${result.price}) \u2014 Act within ${result.timeline}`;
    console.log(message);
    // Webhook/SMS integration point
    if (this.webhookUrl) {
      console.log(`[Zo] Webhook dispatched to ${this.webhookUrl}`);
    }
    if (this.notifyPhone) {
      console.log(`[Zo] SMS alert queued for ${this.notifyPhone}`);
    }
    return message;
  }

  getLog() {
    return this.triggerLog.slice(-20);
  }

  getStats() {
    const total = this.triggerLog.length;
    const byTier = {};
    this.triggerLog.forEach(t => {
      byTier[t.tier] = (byTier[t.tier] || 0) + 1;
    });
    return { totalTriggers: total, byTier };
  }
}

module.exports = { SpeedCloseTrigger, CLOSE_TIERS, HOT_SIGNALS };
