'use strict';

const { checkIdempotency, markProcessed } = require('./idempotency-utils');

const fs = require('fs');
const path = require('path');

/**
 * Factory: createLinkedinEngagementActivities(config)
 * Returns { runLinkedinEngagement }
 */
function createLinkedinEngagementActivities(config = {}) {
  const dataDir = config.dataDir || path.resolve(__dirname, '..', 'data');
  const dataFile = path.join(dataDir, 'linkedin-engagement.json');

  function ensureDataDir() {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  function loadHistory() {
    ensureDataDir();
    if (fs.existsSync(dataFile)) {
      const raw = fs.readFileSync(dataFile, 'utf-8');
      return JSON.parse(raw);
    }
    return { entries: [] };
  }

  function saveHistory(history) {
    ensureDataDir();
    fs.writeFileSync(dataFile, JSON.stringify(history, null, 2), 'utf-8');
  }

  function generateSandboxMetrics(date) {
    const seed = date.split('-').reduce((a, b) => a + Number(b), 0);
    const rand = (min, max) => min + ((seed * 7 + max) % (max - min + 1));
    return {
      posts: rand(1, 5),
      likes: rand(10, 120),
      comments: rand(3, 40),
      profileViews: rand(20, 200),
      connections: rand(0, 15),
      dms: rand(0, 10),
    };
  }

  function compute7DayRollingAverage(entries) {
    const recent = entries.slice(-7);
    if (recent.length === 0) return null;
    const keys = ['posts', 'likes', 'comments', 'profileViews', 'connections', 'dms'];
    const avg = {};
    for (const key of keys) {
      const sum = recent.reduce((acc, e) => acc + (e.metrics[key] || 0), 0);
      avg[key] = Math.round((sum / recent.length) * 100) / 100;
    }
    return avg;
  }

  function identifyPeakEngagementTimes(entries) {
    if (entries.length === 0) return [];
    const sorted = [...entries].sort((a, b) => {
      const scoreA = (a.metrics.likes || 0) + (a.metrics.comments || 0);
      const scoreB = (b.metrics.likes || 0) + (b.metrics.comments || 0);
      return scoreB - scoreA;
    });
    return sorted.slice(0, 3).map((e) => ({
      date: e.date,
      engagementScore: (e.metrics.likes || 0) + (e.metrics.comments || 0),
    }));
  }

  async function runLinkedinEngagement(input) {
    const idempotencyKey = `linkedin-engagement:${input.date}`;
    const existing = await checkIdempotency(idempotencyKey);
    if (existing) {
      return existing;
    }

    const { date, sandbox } = input;
    const history = loadHistory();

    // Collect metrics (sandbox or real)
    let metrics;
    if (sandbox) {
      metrics = generateSandboxMetrics(date);
    } else {
      // In production, call LinkedIn API via config.linkedinClient
      if (config.linkedinClient && typeof config.linkedinClient.fetchDailyMetrics === 'function') {
        metrics = await config.linkedinClient.fetchDailyMetrics(date);
      } else {
        metrics = generateSandboxMetrics(date);
      }
    }

    const entry = {
      date,
      collectedAt: new Date().toISOString(),
      metrics,
      sandbox: !!sandbox,
    };

    // Deduplicate: replace if same date exists
    const existingIdx = history.entries.findIndex((e) => e.date === date);
    if (existingIdx >= 0) {
      history.entries[existingIdx] = entry;
    } else {
      history.entries.push(entry);
    }

    // Sort entries by date
    history.entries.sort((a, b) => a.date.localeCompare(b.date));

    // Compute rolling average and peak times
    const rollingAverage = compute7DayRollingAverage(history.entries);
    const peakTimes = identifyPeakEngagementTimes(history.entries);

    // Compute comparison to rolling average
    let comparison = null;
    if (rollingAverage) {
      comparison = {};
      for (const key of Object.keys(metrics)) {
        const avg = rollingAverage[key] || 0;
        comparison[key] = {
          current: metrics[key],
          average: avg,
          delta: avg > 0 ? Math.round(((metrics[key] - avg) / avg) * 10000) / 100 : null,
        };
      }
    }

    history.lastUpdated = new Date().toISOString();
    history.rollingAverage = rollingAverage;
    history.peakEngagementTimes = peakTimes;

    saveHistory(history);

    const result = {
      date,
      metrics,
      rollingAverage,
      comparison,
      peakEngagementTimes: peakTimes,
      totalEntries: history.entries.length,
    };

    await markProcessed(idempotencyKey, result);

    return result;
  }

  return { runLinkedinEngagement };
}

module.exports = { createLinkedinEngagementActivities };
