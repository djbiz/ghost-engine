"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = path.resolve(__dirname, "..");
var SOUL_PATH = path.join(ROOT, "system", "SOUL.md");
var CRM_PATH = path.join(ROOT, "leads", "crm.csv");
var METRICS_PATH = path.join(ROOT, "leads", "metrics-snapshot.txt");

function today() {
  var d = new Date();
  var yyyy = d.getFullYear();
  var mm = String(d.getMonth() + 1).padStart(2, "0");
  var dd = String(d.getDate()).padStart(2, "0");
  return yyyy + "-" + mm + "-" + dd;
}

function parseCsv(raw) {
  var lines = raw.trim().split("\n");
  if (lines.length < 2) return [];
  var headers = lines[0].split(",").map(function (h) { return h.trim(); });
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var vals = lines[i].split(",");
    if (vals.length < headers.length) continue;
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = vals[j] ? vals[j].trim() : "";
    }
    rows.push(row);
  }
  return rows;
}

function safeNum(val) {
  var n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function parseMetrics(raw) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.log("[sunday-evolution] WARNING: Could not parse metrics-snapshot.txt as JSON");
    return null;
  }
}

function analyzeScoreDistribution(leads) {
  var buckets = { high: 0, medium: 0, low: 0 };
  for (var i = 0; i < leads.length; i++) {
    var s = safeNum(leads[i].score);
    if (s >= 70) {
      buckets.high++;
    } else if (s >= 40) {
      buckets.medium++;
    } else {
      buckets.low++;
    }
  }
  return buckets;
}

function analyzePlatforms(leads) {
  var platforms = {};
  for (var i = 0; i < leads.length; i++) {
    var p = leads[i].platform || "unknown";
    platforms[p] = (platforms[p] || 0) + 1;
  }
  return platforms;
}

function analyzeConversion(leads) {
  var total = leads.length;
  if (total === 0) return { replyRate: 0, totalDms: 0, totalReplies: 0 };
  var totalDms = 0;
  var totalReplies = 0;
  for (var i = 0; i < leads.length; i++) {
    totalDms += safeNum(leads[i].dms_sent);
    totalReplies += safeNum(leads[i].replies);
  }
  var replyRate = totalDms > 0 ? ((totalReplies / totalDms) * 100).toFixed(1) : "0.0";
  return { replyRate: replyRate, totalDms: totalDms, totalReplies: totalReplies };
}

function analyzeStatuses(leads) {
  var statuses = {};
  for (var i = 0; i < leads.length; i++) {
    var st = leads[i].status || "unknown";
    statuses[st] = (statuses[st] || 0) + 1;
  }
  return statuses;
}

function generateLessons(leads, metrics, scores, platforms, conversion, statuses) {
  var stamp = today();
  var lessons = [];

  var total = leads.length;
  if (total > 0) {
    var highPct = ((scores.high / total) * 100).toFixed(0);
    lessons.push("- [" + stamp + "] Score distribution: " + scores.high + " high / " + scores.medium + " mid / " + scores.low + " low (" + highPct + "% high-quality). Focus outreach on high-score segments for better ROI.");
  }

  if (conversion.totalDms > 0) {
    lessons.push("- [" + stamp + "] DM reply rate at " + conversion.replyRate + "% (" + conversion.totalReplies + "/" + conversion.totalDms + "). " + (parseFloat(conversion.replyRate) >= 15 ? "Above baseline - current messaging resonates." : "Below 15% target - iterate on opening hooks and value props."));
  }

  var platformKeys = Object.keys(platforms);
  if (platformKeys.length > 0) {
    var topPlatform = platformKeys.reduce(function (a, b) { return platforms[a] >= platforms[b] ? a : b; });
    lessons.push("- [" + stamp + "] Top platform: " + topPlatform + " (" + platforms[topPlatform] + " leads). Double down on what works; test expansion to secondary channels.");
  }

  if (metrics) {
    var rev = safeNum(metrics.revenue);
    var pipe = safeNum(metrics.pipeline) + safeNum(metrics.impliedPipeline);
    if (rev > 0 || pipe > 0) {
      lessons.push("- [" + stamp + "] Weekly revenue: $" + rev + ", total pipeline: $" + pipe + ". " + (pipe > rev * 3 ? "Healthy pipeline-to-revenue ratio." : "Pipeline needs growth - increase top-of-funnel volume."));
    }
    var booked = safeNum(metrics.bookedCalls);
    var closes = safeNum(metrics.closes);
    if (booked > 0) {
      var closeRate = ((closes / booked) * 100).toFixed(0);
      lessons.push("- [" + stamp + "] Call close rate: " + closeRate + "% (" + closes + "/" + booked + "). " + (parseInt(closeRate) >= 30 ? "Strong closing performance." : "Qualify leads harder before booking calls."));
    }
  }

  if (lessons.length === 0) {
    lessons.push("- [" + stamp + "] Insufficient data for detailed lessons. Ensure CRM and metrics files are populated.");
  }

  return lessons;
}

function generateEvolution(leads, metrics, scores, platforms, conversion, statuses) {
  var stamp = today();
  var insights = [];

  var statusKeys = Object.keys(statuses);
  if (statusKeys.length > 0) {
    var parts = statusKeys.map(function (k) { return k + "=" + statuses[k]; });
    insights.push("- [" + stamp + "] Pipeline status snapshot: " + parts.join(", ") + ". Evolving intake process to move leads through stages faster.");
  }

  if (leads.length > 0 && scores.high > scores.medium + scores.low) {
    insights.push("- [" + stamp + "] Majority high-score leads detected. Personality is attracting quality prospects - maintain current tone and positioning.");
  } else if (leads.length > 0) {
    insights.push("- [" + stamp + "] Lead quality skews mid-to-low. Evolving outreach voice to be more selective and authority-driven to attract higher-tier prospects.");
  }

  if (metrics) {
    var weekLeads = safeNum(metrics.weekLeads);
    var todayLeads = safeNum(metrics.todayLeads);
    if (weekLeads > 0) {
      insights.push("- [" + stamp + "] Weekly lead volume: " + weekLeads + " (today: " + todayLeads + "). Adapting cadence and content strategy to sustain inbound momentum.");
    }
  }

  var platformKeys = Object.keys(platforms);
  if (platformKeys.length >= 2) {
    insights.push("- [" + stamp + "] Active on " + platformKeys.length + " platforms (" + platformKeys.join(", ") + "). Evolving to platform-native communication styles for each channel.");
  }

  if (insights.length === 0) {
    insights.push("- [" + stamp + "] No evolution data available yet. Will reassess as CRM and metrics populate.");
  }

  return insights;
}

function ensureSection(content, heading) {
  var pattern = new RegExp("^## " + heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$", "m");
  if (!pattern.test(content)) {
    content = content.trimEnd() + "\n\n## " + heading + "\n";
    console.log("[sunday-evolution] Created section: ## " + heading);
  }
  return content;
}

function appendToSection(content, heading, entries) {
  var lines = content.split("\n");
  var sectionIdx = -1;
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "## " + heading) {
      sectionIdx = i;
      break;
    }
  }
  if (sectionIdx === -1) return content;

  var insertIdx = sectionIdx + 1;
  for (var j = sectionIdx + 1; j < lines.length; j++) {
    if (lines[j].match(/^## /)) {
      insertIdx = j;
      break;
    }
    if (lines[j].trim() !== "") {
      insertIdx = j + 1;
    }
  }
  if (insertIdx <= sectionIdx + 1) {
    insertIdx = sectionIdx + 1;
  }

  var before = lines.slice(0, insertIdx);
  var after = lines.slice(insertIdx);
  var merged = before.concat(entries).concat(after);
  return merged.join("\n");
}

function main() {
  console.log("[sunday-evolution] Starting Sunday Evolution cycle...");
  console.log("[sunday-evolution] Date: " + today());

  if (!fs.existsSync(SOUL_PATH)) {
    console.log("[sunday-evolution] ERROR: SOUL.md not found at " + SOUL_PATH);
    process.exit(1);
  }

  var soulContent = fs.readFileSync(SOUL_PATH, "utf8");
  console.log("[sunday-evolution] Loaded SOUL.md (" + soulContent.length + " chars)");

  var leads = [];
  if (fs.existsSync(CRM_PATH)) {
    var crmRaw = fs.readFileSync(CRM_PATH, "utf8");
    leads = parseCsv(crmRaw);
    console.log("[sunday-evolution] Loaded CRM: " + leads.length + " leads");
  } else {
    console.log("[sunday-evolution] WARNING: crm.csv not found, proceeding with empty lead set");
  }

  var metrics = null;
  if (fs.existsSync(METRICS_PATH)) {
    var metricsRaw = fs.readFileSync(METRICS_PATH, "utf8");
    metrics = parseMetrics(metricsRaw);
    if (metrics) {
      console.log("[sunday-evolution] Loaded metrics snapshot for date: " + (metrics.date || "unknown"));
    }
  } else {
    console.log("[sunday-evolution] WARNING: metrics-snapshot.txt not found, proceeding without metrics");
  }

  var scores = analyzeScoreDistribution(leads);
  var platforms = analyzePlatforms(leads);
  var conversion = analyzeConversion(leads);
  var statuses = analyzeStatuses(leads);

  console.log("[sunday-evolution] Analysis complete:");
  console.log("  Leads: " + leads.length);
  console.log("  Score dist: high=" + scores.high + " mid=" + scores.medium + " low=" + scores.low);
  console.log("  Platforms: " + JSON.stringify(platforms));
  console.log("  DM reply rate: " + conversion.replyRate + "%");
  console.log("  Statuses: " + JSON.stringify(statuses));

  var lessons = generateLessons(leads, metrics, scores, platforms, conversion, statuses);
  var evolution = generateEvolution(leads, metrics, scores, platforms, conversion, statuses);

  soulContent = ensureSection(soulContent, "Lessons Learned");
  soulContent = ensureSection(soulContent, "Evolution Log");

  soulContent = appendToSection(soulContent, "Lessons Learned", lessons);
  soulContent = appendToSection(soulContent, "Evolution Log", evolution);

  fs.writeFileSync(SOUL_PATH, soulContent, "utf8");
  console.log("[sunday-evolution] SOUL.md updated successfully");

  console.log("\n=== SUNDAY EVOLUTION SUMMARY ===");
  console.log("Lessons added: " + lessons.length);
  lessons.forEach(function (l) { console.log("  " + l); });
  console.log("Evolution insights added: " + evolution.length);
  evolution.forEach(function (e) { console.log("  " + e); });
  console.log("================================");
}

main();
