// temporal/proof-loop-activities.js
// Factory: createProofLoopActivities(config)
// Returns { runProofLoop }
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Factory that returns proof-loop activity functions.
 * @param {object} config
 * @param {string} config.baseDir - project root directory
 * @returns {{ runProofLoop: function }}
 */
function createProofLoopActivities(config) {
  const baseDir = config && config.baseDir ? config.baseDir : process.cwd();

  /**
   * Parse a CSV file into an array of row objects.
   * Handles missing files gracefully by returning [].
   */
  function parseCsv(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf-8').trim();
    if (!raw) return [];
    const [headerLine, ...lines] = raw.split('\n');
    const headers = headerLine.split(',').map(h => h.trim());
    return lines.map(line => {
      const values = line.split(',').map(v => v.trim());
      const row = {};
      headers.forEach((h, i) => { row[h] = values[i] || ''; });
      return row;
    });
  }

  /**
   * Core activity: detects new closed-won deals from CRM,
   * generates proof assets (case study outlines, social posts,
   * win announcements), and writes them to data/proof-assets/.
   */
  async function runProofLoop({ date }) {
    const today = date || new Date().toISOString().slice(0, 10);

    // --- Read CRM data ---
    const crmPath = path.join(baseDir, 'data', 'crm.csv');
    const crmRows = parseCsv(crmPath);

    // --- Detect closed-won deals for today ---
    const closedWonDeals = crmRows.filter(r => {
      const status = (r.status || r.Status || '').toLowerCase();
      const rowDate = r.date || r.Date || '';
      return rowDate.startsWith(today) && (status === 'closed-won' || status === 'closed won');
    });

    if (closedWonDeals.length === 0) {
      return { dealsProcessed: 0, date: today, assets: [] };
    }

    // --- Generate proof assets ---
    const assetsDir = path.join(baseDir, 'data', 'proof-assets');
    fs.mkdirSync(assetsDir, { recursive: true });

    const assets = [];

    closedWonDeals.forEach((deal, idx) => {
      const company = deal.company || deal.Company || deal.name || deal.Name || `Deal-${idx + 1}`;
      const value = deal.value || deal.Value || deal.amount || deal.Amount || 'N/A';
      const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
      const dealDir = path.join(assetsDir, `${today}-${slug}`);
      fs.mkdirSync(dealDir, { recursive: true });

      // Case study outline
      const caseStudy = [
        `# Case Study: ${company}`,
        ``,
        `**Close Date:** ${today}`,
        `**Deal Value:** ${value}`,
        ``,
        `## Challenge`,
        `[Describe the problem ${company} faced before engagement.]`,
        ``,
        `## Solution`,
        `[Describe the Ghost Engine approach and deliverables.]`,
        ``,
        `## Results`,
        `[Quantify outcomes: revenue impact, efficiency gains, timeline.]`,
        ``,
        `## Quote`,
        `> "[Client testimonial placeholder]" —  ${company}`,
        ``,
        `---`,
        `Generated: ${new Date().toISOString()}`,
      ].join('\n');
      fs.writeFileSync(path.join(dealDir, 'case-study-outline.md'), caseStudy, 'utf-8');

      // Social post
      const socialPost = [
        `NEW WIN: ${company}`,
        ``,
        `We just closed a deal with ${company} (${value}).`,
        ``,
        `Here's what made the difference:`,
        `- Targeted outreach via Ghost Engine campaigns`,
        `- Proof-driven follow-up sequence`,
        `- Fast time-to-value delivery`,
        ``,
        `More details coming soon.`,
        ``,
        `#GhostEngine #ClosedWon #B2BSales`,
        ``,
        `---`,
        `Generated: ${new Date().toISOString()}`,
      ].join('\n');
      fs.writeFileSync(path.join(dealDir, 'social-post.md'), socialPost, 'utf-8');

      // Win announcement
      const winAnnouncement = [
        `WIN ANNOUNCEMENT`,
        `================`,
        ``,
        `Company:    ${company}`,
        `Deal Value: ${value}`,
        `Close Date: ${today}`,
        ``,
        `Summary:`,
        `${company} has officially signed. This deal demonstrates`,
        `the effectiveness of our ghost-engine-campaigns pipeline.`,
        ``,
        `Next Steps:`,
        `- Kick off onboarding within 48 hours`,
        `- Collect testimonial within 30 days`,
        `- Publish case study within 60 days`,
        ``,
        `---`,
        `Generated: ${new Date().toISOString()}`,
      ].join('\n');
      fs.writeFileSync(path.join(dealDir, 'win-announcement.txt'), winAnnouncement, 'utf-8');

      assets.push({
        company,
        value,
        directory: dealDir,
        files: ['case-study-outline.md', 'social-post.md', 'win-announcement.txt'],
      });
    });

    return { dealsProcessed: closedWonDeals.length, date: today, assets };
  }

  return { runProofLoop };
}

module.exports = { createProofLoopActivities };
