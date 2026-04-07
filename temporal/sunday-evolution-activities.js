'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Factory: createSundayEvolutionActivities(config)
 * Returns { runSundayEvolution }
 *
 * Reads CRM data + metrics, analyzes score distribution, platforms,
 * and conversion rates. Generates lessons and evolution insights,
 * then appends findings to system/SOUL.md.
 */
function createSundayEvolutionActivities(config) {
  const basePath = config.basePath || process.cwd();
  const crmPath = path.join(basePath, 'leads', 'crm.csv');
  const soulPath = path.join(basePath, 'system', 'SOUL.md');

  function parseCsv(raw) {
    const lines = raw.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    });
    return { headers, rows };
  }

  function analyzeScores(rows) {
    const scores = rows.map(r => parseInt(r.score, 10)).filter(s => !isNaN(s));
    if (!scores.length) return { total: 0, avg: 0, median: 0, buckets: {} };
    scores.sort((a, b) => a - b);
    const total = scores.length;
    const avg = Math.round(scores.reduce((s, v) => s + v, 0) / total);
    const median = scores[Math.floor(total / 2)];
    const buckets = { cold: 0, warm: 0, hot: 0, onFire: 0 };
    for (const s of scores) {
      if (s >= 80) buckets.onFire++;
      else if (s >= 50) buckets.hot++;
      else if (s >= 20) buckets.warm++;
      else buckets.cold++;
    }
    return { total, avg, median, buckets };
  }

  function analyzePlatforms(rows) {
    const platforms = {};
    for (const row of rows) {
      const p = row.platform || row.source || 'unknown';
      if (!platforms[p]) platforms[p] = { count: 0, totalScore: 0, converted: 0 };
      platforms[p].count++;
      platforms[p].totalScore += parseInt(row.score, 10) || 0;
      if (row.status === 'converted' || row.status === 'won') platforms[p].converted++;
    }
    return Object.entries(platforms).map(([name, d]) => ({
      name, count: d.count,
      avgScore: d.count ? Math.round(d.totalScore / d.count) : 0,
      conversionRate: d.count ? Math.round((d.converted / d.count) * 100) : 0,
    }));
  }

  function analyzeConversion(rows) {
    const total = rows.length;
    const converted = rows.filter(r => r.status === 'converted' || r.status === 'won').length;
    const rate = total ? Math.round((converted / total) * 100) : 0;
    return { total, converted, rate };
  }

  function generateLessons(scoreDist, platforms, conversion) {
    const lessons = [];
    if (scoreDist.avg < 30) lessons.push('Average lead score is low — review lead generation quality.');
    if (scoreDist.avg > 60) lessons.push('Strong average scores — focus on conversion optimization.');
    if (scoreDist.buckets.cold > scoreDist.total * 0.5) lessons.push('Over 50% cold leads — consider re-engagement or pruning.');
    if (scoreDist.buckets.onFire > 0) lessons.push(`${scoreDist.buckets.onFire} on-fire leads detected — prioritize immediate outreach.`);
    const topPlatform = platforms.sort((a, b) => b.avgScore - a.avgScore)[0];
    if (topPlatform) lessons.push(`Top platform by score: ${topPlatform.name} (avg ${topPlatform.avgScore}).`);
    if (conversion.rate < 10) lessons.push('Conversion rate below 10% — review pipeline bottlenecks.');
    if (conversion.rate > 30) lessons.push('Strong conversion rate — document and replicate winning patterns.');
    if (!lessons.length) lessons.push('Metrics are stable — continue current strategy.');
    return lessons;
  }

  function formatReport(date, scoreDist, platforms, conversion, lessons) {
    const lines = [
      `\n## Weekly Evolution — ${date}\n`,
      '### Score Distribution',
      `- Total leads: ${scoreDist.total}`,
      `- Average score: ${scoreDist.avg} | Median: ${scoreDist.median}`,
      `- Cold (<20): ${scoreDist.buckets.cold || 0} | Warm (20-49): ${scoreDist.buckets.warm || 0} | Hot (50-79): ${scoreDist.buckets.hot || 0} | On Fire (80+): ${scoreDist.buckets.onFire || 0}`,
      '',
      '### Platform Analysis',
      ...platforms.map(p => `- ${p.name}: ${p.count} leads, avg score ${p.avgScore}, conversion ${p.conversionRate}%`),
      '',
      '### Conversion',
      `- ${conversion.converted}/${conversion.total} converted (${conversion.rate}%)`,
      '',
      '### Lessons Learned',
      ...lessons.map(l => `- ${l}`),
      '',
    ];
    return lines.join('\n');
  }

  async function runSundayEvolution({ date }) {
    console.log(`[sunday-evolution-activity] Starting evolution analysis for ${date}`);

    if (!fs.existsSync(crmPath)) {
      console.log(`[sunday-evolution-activity] CRM file not found at ${crmPath}, skipping`);
      return { analyzed: false, reason: 'crm-not-found' };
    }

    const raw = fs.readFileSync(crmPath, 'utf-8');
    const { rows } = parseCsv(raw);

    const scoreDist = analyzeScores(rows);
    const platforms = analyzePlatforms(rows);
    const conversion = analyzeConversion(rows);
    const lessons = generateLessons(scoreDist, platforms, conversion);
    const report = formatReport(date, scoreDist, platforms, conversion, lessons);

    const soulDir = path.dirname(soulPath);
    if (!fs.existsSync(soulDir)) fs.mkdirSync(soulDir, { recursive: true });

    fs.appendFileSync(soulPath, report, 'utf-8');

    console.log(`[sunday-evolution-activity] Finished: ${rows.length} leads analyzed, ${lessons.length} lessons generated`);
    return { analyzed: true, leads: rows.length, lessons: lessons.length };
  }

  return { runSundayEvolution };
}

module.exports = { createSundayEvolutionActivities };
