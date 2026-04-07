'use strict';

var fs = require('fs');
var path = require('path');

/**
 * Factory: createContentEngineActivities(config)
 * Returns { runContentEngine }
 */
function createContentEngineActivities(config) {
  var dataDir = (config || {}).dataDir || path.resolve(__dirname, '../data');
  var briefsDir = (config || {}).briefsDir || path.resolve(__dirname, '../data/content-briefs');

  /**
   * runContentEngine
   * - Gathers content signals from pipeline/outreach data
   * - Generates daily content brief with 3-5 content ideas
   * - Each idea has: hook, angle, format, platform
   * - Archives brief to data/content-briefs/
   */
  async function runContentEngine(input) {
    var runId = input.runId;
    var date = input.date;

    // Gather content signals from pipeline data
    var signals = gatherSignals(dataDir, date);

    // Generate 3-5 content ideas based on signals
    var ideas = generateIdeas(signals, date);

    // Build the daily brief
    var brief = {
      runId: runId,
      date: date,
      generatedAt: new Date().toISOString(),
      signalsSummary: signals.summary,
      contentIdeas: ideas,
      totalIdeas: ideas.length,
    };

    // Archive brief to data/content-briefs/
    if (!fs.existsSync(briefsDir)) fs.mkdirSync(briefsDir, { recursive: true });
    var briefPath = path.join(briefsDir, 'content-brief-' + date + '.json');
    fs.writeFileSync(briefPath, JSON.stringify(brief, null, 2));
    console.log('[ContentEngine] Brief archived: ' + briefPath);

    return brief;
  }

  function gatherSignals(dir, date) {
    var signals = { topics: [], pains: [], stages: {}, outreachHits: [], summary: '' };

    // Read pipeline CSV for stage distribution and common pain points
    var csvPath = path.join(dir, 'pipeline.csv');
    if (fs.existsSync(csvPath)) {
      var lines = fs.readFileSync(csvPath, 'utf-8').trim().split('\n');
      if (lines.length > 1) {
        var hdr = lines[0].split(',').map(function (h) { return h.trim().toLowerCase(); });
        var rows = lines.slice(1).map(function (l) {
          var v = l.split(','); var o = {};
          hdr.forEach(function (h, i) { o[h] = (v[i] || '').trim(); });
          return o;
        });
        rows.forEach(function (r) {
          signals.stages[r.stage] = (signals.stages[r.stage] || 0) + 1;
          if (r.pain_point) signals.pains.push(r.pain_point);
          if (r.industry) signals.topics.push(r.industry);
        });
      }
    }

    // Read outreach log for engagement signals
    var outreachPath = path.join(dir, 'outreach-log.csv');
    if (fs.existsSync(outreachPath)) {
      var oLines = fs.readFileSync(outreachPath, 'utf-8').trim().split('\n');
      if (oLines.length > 1) {
        var oHdr = oLines[0].split(',').map(function (h) { return h.trim().toLowerCase(); });
        oLines.slice(1).forEach(function (l) {
          var v = l.split(','); var o = {};
          oHdr.forEach(function (h, i) { o[h] = (v[i] || '').trim(); });
          if (o.status === 'replied' || o.status === 'engaged') signals.outreachHits.push(o);
        });
      }
    }

    // Deduplicate and summarize
    signals.topics = Array.from(new Set(signals.topics)).slice(0, 10);
    signals.pains = Array.from(new Set(signals.pains)).slice(0, 10);
    var topStage = Object.keys(signals.stages).sort(function (a, b) {
      return signals.stages[b] - signals.stages[a];
    })[0] || 'unknown';
    signals.summary = 'Top stage: ' + topStage + ', ' + signals.topics.length + ' industries, ' + signals.pains.length + ' pain points, ' + signals.outreachHits.length + ' engaged leads';

    return signals;
  }

  function generateIdeas(signals, date) {
    var formats = ['LinkedIn post', 'Twitter thread', 'Short-form video', 'Newsletter section', 'Blog post'];
    var platforms = ['LinkedIn', 'Twitter', 'YouTube', 'Email', 'Blog'];
    var ideas = [];

    // Idea 1: based on top pain point
    if (signals.pains.length > 0) {
      ideas.push({
        hook: 'Most ' + (signals.topics[0] || 'B2B') + ' teams struggle with ' + signals.pains[0],
        angle: 'Address the #1 pain point from pipeline data',
        format: formats[0],
        platform: platforms[0],
      });
    }

    // Idea 2: stage-based insight
    var stageKeys = Object.keys(signals.stages);
    if (stageKeys.length > 0) {
      var bottleneck = stageKeys.sort(function (a, b) { return signals.stages[b] - signals.stages[a]; })[0];
      ideas.push({
        hook: 'Why most deals stall at the ' + bottleneck + ' stage',
        angle: 'Use pipeline stage data to show bottleneck insights',
        format: formats[1],
        platform: platforms[1],
      });
    }

    // Idea 3: outreach engagement insight
    if (signals.outreachHits.length > 0) {
      ideas.push({
        hook: 'We tested ' + signals.outreachHits.length + ' outreach messages. Here is what worked.',
        angle: 'Share real outreach engagement data as social proof',
        format: formats[2],
        platform: platforms[2],
      });
    }

    // Idea 4: industry trend
    if (signals.topics.length > 1) {
      ideas.push({
        hook: signals.topics.slice(0, 3).join(', ') + ' - 3 industries we are watching in ' + date.slice(0, 7),
        angle: 'Highlight industry diversity in the pipeline',
        format: formats[3],
        platform: platforms[3],
      });
    }

    // Idea 5: general authority content
    ideas.push({
      hook: 'The daily pipeline health check every sales team needs',
      angle: 'Position the automated pipeline review as thought leadership',
      format: formats[4],
      platform: platforms[4],
    });

    return ideas.slice(0, 5);
  }

  return { runContentEngine: runContentEngine };
}

module.exports = { createContentEngineActivities: createContentEngineActivities };
