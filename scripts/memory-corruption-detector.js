#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Ghost Engine — Memory Corruption Detector
// Validates the 3-layer memory system files for structural integrity.
// Exit 0 = all clean · Exit 1 = corruption detected
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..');
const SYSTEM_DIR = path.join(ROOT, 'system');
const LOGS_DIR = path.join(ROOT, 'logs');
const CHECKSUMS_PATH = path.join(SYSTEM_DIR, '.memory-checksums.json');
const REPORT_PATH = path.join(LOGS_DIR, 'memory-integrity-report.txt');

// Expected memory-layer files and their minimum H2-header counts.
const MEMORY_FILES = [
  { name: 'SOUL.md',      minH2: 3 },
  { name: 'IDENTITY.md',  minH2: 2 },
  { name: 'BOOTSTRAP.md', minH2: 1 },
];

const SIZE_MIN = 100;        // bytes — below this the file looks truncated
const SIZE_MAX = 100 * 1024; // 100 KB — above this the file looks bloated

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function loadChecksums() {
  try {
    return JSON.parse(fs.readFileSync(CHECKSUMS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveChecksums(obj) {
  fs.writeFileSync(CHECKSUMS_PATH, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function timestamp() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Validation logic
// ---------------------------------------------------------------------------

function validateFile(filePath, spec, storedChecksums) {
  const result = {
    file: spec.name,
    status: 'CLEAN',
    issues: [],
    hash: null,
  };

  const fullPath = path.join(SYSTEM_DIR, spec.name);

  // 1. Existence check
  if (!fs.existsSync(fullPath)) {
    result.status = 'MISSING';
    result.issues.push('File does not exist');
    return result;
  }

  const buf = fs.readFileSync(fullPath);
  const content = buf.toString('utf8');
  const hash = sha256(buf);
  result.hash = hash;

  // Non-empty check
  if (buf.length === 0) {
    result.status = 'CORRUPTED';
    result.issues.push('File is empty (0 bytes)');
    return result;
  }

  // Checksum fast-path: unchanged file that was previously clean → skip deep checks
  const prev = storedChecksums[spec.name];
  if (prev && prev.hash === hash && prev.status === 'CLEAN') {
    console.log(`  [SKIP] ${spec.name} — checksum unchanged, previously clean`);
    return result;
  }

  console.log(`  [SCAN] ${spec.name} — running deep checks`);

  // 2. File size anomalies
  if (buf.length < SIZE_MIN) {
    result.issues.push(`File appears truncated (${buf.length} bytes < ${SIZE_MIN} byte minimum)`);
  }
  if (buf.length > SIZE_MAX) {
    result.issues.push(`File appears bloated (${buf.length} bytes > ${SIZE_MAX} byte maximum)`);
  }

  // 3a. Null bytes / binary content
  if (buf.includes(0x00)) {
    result.issues.push('Contains null bytes — possible binary corruption');
  }

  // 3b. Structure validation — H2 headers
  const h2Regex = /^## .+/gm;
  const h2Matches = content.match(h2Regex) || [];
  if (h2Matches.length < spec.minH2) {
    result.issues.push(
      `Expected at least ${spec.minH2} H2 header(s), found ${h2Matches.length}`
    );
  }

  // 3c. Duplicate H2 section headers
  const h2Set = new Set();
  for (const h of h2Matches) {
    const normalized = h.trim().toLowerCase();
    if (h2Set.has(normalized)) {
      result.issues.push(`Duplicate H2 header: "${h.trim()}"`);
    }
    h2Set.add(normalized);
  }

  // 3d. Empty sections (H2 immediately followed by another H2 with no content)
  const emptySection = /^## .+\n\s*\n?^## /m;
  if (emptySection.test(content)) {
    result.issues.push('Empty section detected (H2 followed immediately by another H2 with no content)');
  }

  // 3e. Broken markdown — unclosed code blocks (odd number of triple backticks)
  const fenceCount = (content.match(/^```/gm) || []).length;
  if (fenceCount % 2 !== 0) {
    result.issues.push(`Unclosed code block detected (${fenceCount} triple-backtick fence(s) — odd count)`);
  }

  // Determine final status
  if (result.issues.length > 0) {
    result.status = 'CORRUPTED';
  }

  return result;
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

function buildReport(results) {
  const lines = [];
  lines.push('='.repeat(60));
  lines.push('GHOST ENGINE — Memory Integrity Report');
  lines.push(`Generated: ${timestamp()}`);
  lines.push('='.repeat(60));
  lines.push('');

  for (const r of results) {
    const badge = r.status === 'CLEAN' ? '[CLEAN]'
                : r.status === 'MISSING' ? '[MISSING]'
                : '[CORRUPTED]';
    lines.push(`${badge}  ${r.file}`);
    if (r.issues.length > 0) {
      for (const issue of r.issues) {
        lines.push(`         - ${issue}`);
      }
    }
    if (r.hash) {
      lines.push(`         sha256: ${r.hash}`);
    }
    lines.push('');
  }

  const corrupted = results.filter(r => r.status !== 'CLEAN').length;
  lines.push('-'.repeat(60));
  if (corrupted === 0) {
    lines.push('RESULT: ALL LAYERS CLEAN');
  } else {
    lines.push(`RESULT: ${corrupted} layer(s) with issues — ACTION REQUIRED`);
  }
  lines.push('-'.repeat(60));
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('');
  console.log('Ghost Engine — Memory Corruption Detector');
  console.log(`Timestamp: ${timestamp()}`);
  console.log(`System dir: ${SYSTEM_DIR}`);
  console.log('');

  ensureDir(LOGS_DIR);

  const storedChecksums = loadChecksums();
  const results = [];

  for (const spec of MEMORY_FILES) {
    console.log(`Checking ${spec.name}...`);
    const r = validateFile(spec.name, spec, storedChecksums);
    results.push(r);
    console.log(`  -> ${r.status}${r.issues.length ? ' (' + r.issues.length + ' issue(s))' : ''}`);
  }

  // Update stored checksums
  const newChecksums = {};
  for (const r of results) {
    if (r.hash) {
      newChecksums[r.file] = { hash: r.hash, status: r.status, checked: timestamp() };
    }
  }
  saveChecksums(newChecksums);

  // Write report
  const report = buildReport(results);
  fs.writeFileSync(REPORT_PATH, report, 'utf8');
  console.log('');
  console.log(`Report written to: ${REPORT_PATH}`);

  // Print report to stdout as well
  console.log('');
  console.log(report);

  // Exit code
  const hasCorruption = results.some(r => r.status !== 'CLEAN');
  if (hasCorruption) {
    console.log('Exiting with code 1 — corruption detected.');
    process.exit(1);
  } else {
    console.log('Exiting with code 0 — all layers clean.');
    process.exit(0);
  }
}

main();
