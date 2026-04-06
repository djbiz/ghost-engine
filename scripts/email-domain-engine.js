const fs = require('fs');
const path = require('path');

/**
 * Compute the effective warmup day and daily send limit for a domain entry.
 * @param {Object} entry - Must have an `added` string field (ISO date)
 * @returns {{ day: number, limit: number }}
 */
function effectiveWarmupDay(entry) {
  const daysAgo = Math.floor((Date.now() - new Date(entry.added)) / 86400000);
  const limit = Math.min(40, 5 + daysAgo);
  return { day: daysAgo, limit };
}

/**
 * Pick the next domain to send from using load-balanced round-robin.
 * Returns the eligible domain with the fewest sends today, or null.
 * @param {Array<{ name: string, added: string }>} domains
 * @param {Object} sendsToday - map of domain name → send count today
 * @returns {Object|null}
 */
function getNextDomain(domains, sendsToday) {
  const eligible = domains.filter((d) => {
    const { limit } = effectiveWarmupDay(d);
    const sent = sendsToday[d.name] || 0;
    return sent < limit;
  });

  if (eligible.length === 0) return null;

  return eligible.reduce((best, d) => {
    const bestSent = sendsToday[best.name] || 0;
    const dSent = sendsToday[d.name] || 0;
    return dSent < bestSent ? d : best;
  });
}

/**
 * Ensure a daily markdown file exists for the given date.
 * Creates it from daily/TEMPLATE.md if it doesn't exist yet.
 * @param {Date} [date]
 */
function ensureDailyFile(date) {
  if (!date) date = new Date();

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  const repoRoot = path.join(__dirname, '..');
  const dailyDir = path.join(repoRoot, 'daily');
  const filePath = path.join(dailyDir, `${dateStr}.md`);

  if (fs.existsSync(filePath)) return;

  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
  const fullDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const templatePath = path.join(dailyDir, 'TEMPLATE.md');
  let content = fs.readFileSync(templatePath, 'utf8');

  content = content.replace(/\{\{DATE\}\}/g, dateStr);
  content = content.replace(/\{\{DAY_OF_WEEK\}\}/g, dayOfWeek);
  content = content.replace(/\{\{FULL_DATE\}\}/g, fullDate);

  fs.writeFileSync(filePath, content, 'utf8');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
if (require.main === module) {
  const [, , cmd, arg] = process.argv;

  if (cmd === 'warmup-day') {
    if (!arg) {
      console.error('Usage: email-domain-engine.js warmup-day <added-date>');
      process.exit(1);
    }
    console.log(JSON.stringify(effectiveWarmupDay({ added: arg }), null, 2));
  } else if (cmd === 'ensure-daily') {
    const date = arg ? new Date(arg + 'T00:00:00') : new Date();
    ensureDailyFile(date);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    console.log(`Ensured daily/${yyyy}-${mm}-${dd}.md`);
  } else if (cmd === 'next-domain') {
    const domains = [
      { name: 'alpha.com', added: '2026-03-20' },
      { name: 'beta.com', added: '2026-04-01' },
      { name: 'gamma.com', added: '2026-04-04' },
    ];
    const sendsToday = { 'alpha.com': 12, 'beta.com': 3 };
    const next = getNextDomain(domains, sendsToday);
    console.log('Domains:', JSON.stringify(domains, null, 2));
    console.log('Sends today:', JSON.stringify(sendsToday, null, 2));
    console.log('Next domain:', next ? next.name : null);
  } else {
    console.error(
      'Usage:\n' +
        '  email-domain-engine.js warmup-day <added-date>\n' +
        '  email-domain-engine.js ensure-daily [YYYY-MM-DD]\n' +
        '  email-domain-engine.js next-domain'
    );
    process.exit(1);
  }
}

module.exports = { effectiveWarmupDay, getNextDomain, ensureDailyFile };
