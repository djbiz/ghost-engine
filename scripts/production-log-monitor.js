"use strict";

var fs = require("fs");
var path = require("path");
var childProcess = require("child_process");

var ROOT = path.resolve(__dirname, "..");
var LOGS_DIR = path.join(ROOT, "logs");
var DAILY_DIR = path.join(ROOT, "daily");
var TODAY = new Date().toISOString().slice(0, 10);
var NOW = new Date();
var REPORT_PATH = path.join(LOGS_DIR, "health-report.txt");

var HEARTBEAT_SCHEDULE = [
  { name: "heartbeat-0730", hour: 7, minute: 30, script: "heartbeat-morning.js", label: "Morning Lead Hunter" },
  { name: "heartbeat-0900", hour: 9, minute: 0, script: "heartbeat-outreach.js", label: "Outreach + LinkedIn" },
  { name: "heartbeat-1100", hour: 11, minute: 0, script: "heartbeat-content.js", label: "Fulfillment" },
  { name: "heartbeat-2300", hour: 23, minute: 0, script: "heartbeat-nightly.js", label: "Nightly Consolidator" }
];

var CRITICAL_PATTERNS = [
  "FATAL", "uncaughtException", "unhandledRejection",
  "ECONNREFUSED", "ENOMEM", "heap out of memory", "ENOSPC", "segmentation fault"
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getPm2Status() {
  var result = { available: false, processes: [], issues: [] };
  try {
    var raw = childProcess.execSync("pm2 jlist", { encoding: "utf8", timeout: 10000 });
    var list = JSON.parse(raw);
    result.available = true;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var info = {
        name: p.name || "unknown",
        status: (p.pm2_env && p.pm2_env.status) || "unknown",
        pid: p.pid || 0,
        uptime: p.pm2_env ? (NOW.getTime() - (p.pm2_env.pm_uptime || 0)) : 0,
        restarts: (p.pm2_env && p.pm2_env.restart_time) || 0,
        memory: (p.monit && p.monit.memory) || 0,
        cpu: (p.monit && p.monit.cpu) || 0
      };
      result.processes.push(info);
      if (info.status !== "online") {
        result.issues.push("CRITICAL: Process " + info.name + " is " + info.status);
      }
      if (info.restarts > 5) {
        result.issues.push("WARNING: Process " + info.name + " has restarted " + info.restarts + " times");
      }
      if (info.memory > 500 * 1024 * 1024) {
        result.issues.push("WARNING: Process " + info.name + " using " + Math.round(info.memory / 1024 / 1024) + "MB memory");
      }
    }
    if (list.length === 0) {
      result.issues.push("WARNING: No PM2 processes found");
    }
  } catch (e) {
    result.issues.push("INFO: PM2 not available or no processes running (" + (e.message || "unknown error").slice(0, 80) + ")");
  }
  return result;
}

function checkHeartbeats() {
  var result = { beats: [], issues: [] };
  var pm2LogDir = path.join(process.env.HOME || "/root", ".pm2", "logs");
  for (var i = 0; i < HEARTBEAT_SCHEDULE.length; i++) {
    var beat = HEARTBEAT_SCHEDULE[i];
    var beatInfo = { name: beat.name, label: beat.label, expectedHour: beat.hour, expectedMinute: beat.minute, lastRun: null, status: "unknown" };
    var logFile = path.join(pm2LogDir, beat.name + "-out.log");
    var altLog = path.join(LOGS_DIR, beat.name + ".log");
    var dailyLog = path.join(DAILY_DIR, TODAY + "-" + beat.name + ".log");
    var targetLog = null;
    if (fs.existsSync(logFile)) { targetLog = logFile; }
    else if (fs.existsSync(altLog)) { targetLog = altLog; }
    else if (fs.existsSync(dailyLog)) { targetLog = dailyLog; }
    if (targetLog) {
      try {
        var stat = fs.statSync(targetLog);
        beatInfo.lastRun = stat.mtime.toISOString();
        var ageMs = NOW.getTime() - stat.mtime.getTime();
        var ageHours = ageMs / (1000 * 60 * 60);
        if (ageHours > 25) { beatInfo.status = "missed"; result.issues.push("CRITICAL: " + beat.label + " (" + beat.name + ") last ran " + Math.round(ageHours) + "h ago"); }
        else if (ageHours > 13) { beatInfo.status = "stale"; result.issues.push("WARNING: " + beat.label + " (" + beat.name + ") last ran " + Math.round(ageHours) + "h ago"); }
        else { beatInfo.status = "ok"; }
      } catch (e) {
        beatInfo.status = "error";
        result.issues.push("WARNING: Could not read log for " + beat.name + ": " + (e.message || "unknown"));
      }
    } else {
      beatInfo.status = "no-log";
      result.issues.push("INFO: No log file found for " + beat.label + " (" + beat.name + ")");
    }
    result.beats.push(beatInfo);
  }
  return result;
}

function scanLogsForCritical() {
  var result = { scanned: 0, matches: [], issues: [] };
  var dirs = [LOGS_DIR, DAILY_DIR];
  for (var d = 0; d < dirs.length; d++) {
    if (!fs.existsSync(dirs[d])) { continue; }
    var files = fs.readdirSync(dirs[d]);
    for (var f = 0; f < files.length; f++) {
      var filePath = path.join(dirs[d], files[f]);
      try {
        var stat = fs.statSync(filePath);
        if (!stat.isFile()) { continue; }
        var ageMs = NOW.getTime() - stat.mtime.getTime();
        if (ageMs > 48 * 60 * 60 * 1000) { continue; }
        result.scanned++;
        var content = fs.readFileSync(filePath, "utf8");
        var lines = content.split("\n");
        var lastLines = lines.slice(-200);
        for (var l = 0; l < lastLines.length; l++) {
          for (var p = 0; p < CRITICAL_PATTERNS.length; p++) {
            if (lastLines[l].indexOf(CRITICAL_PATTERNS[p]) !== -1) {
              result.matches.push({ file: files[f], pattern: CRITICAL_PATTERNS[p], line: lastLines[l].slice(0, 200) });
              if (result.matches.length >= 50) { break; }
            }
          }
          if (result.matches.length >= 50) { break; }
        }
      } catch (e) { /* skip unreadable files */ }
      if (result.matches.length >= 50) { break; }
    }
  }
  if (result.matches.length > 0) {
    result.issues.push("CRITICAL: Found " + result.matches.length + " critical pattern matches in recent logs");
  }
  return result;
}

function checkDiskSpace() {
  var result = { available: false, info: null, issues: [] };
  try {
    var raw = childProcess.execSync("df -h " + ROOT, { encoding: "utf8", timeout: 5000 });
    var lines = raw.trim().split("\n");
    if (lines.length >= 2) {
      var parts = lines[1].split(/\s+/);
      result.available = true;
      result.info = { filesystem: parts[0], size: parts[1], used: parts[2], available: parts[3], usePercent: parts[4] };
      var pct = parseInt(parts[4], 10);
      if (pct > 90) { result.issues.push("CRITICAL: Disk usage at " + parts[4]); }
      else if (pct > 80) { result.issues.push("WARNING: Disk usage at " + parts[4]); }
    }
  } catch (e) {
    result.issues.push("INFO: Could not check disk space: " + (e.message || "unknown").slice(0, 80));
  }
  return result;
}

function checkLogRotation() {
  var result = { issues: [] };
  if (!fs.existsSync(LOGS_DIR)) { return result; }
  var files = fs.readdirSync(LOGS_DIR);
  for (var i = 0; i < files.length; i++) {
    var filePath = path.join(LOGS_DIR, files[i]);
    try {
      var stat = fs.statSync(filePath);
      if (stat.isFile() && stat.size > 50 * 1024 * 1024) {
        result.issues.push("WARNING: Log file " + files[i] + " is " + Math.round(stat.size / 1024 / 1024) + "MB - consider rotation");
      }
    } catch (e) { /* skip */ }
  }
  return result;
}

function generateReport(pm2Status, heartbeats, logScan, diskSpace, logRotation) {
  var lines = [];
  var allIssues = [].concat(pm2Status.issues, heartbeats.issues, logScan.issues, diskSpace.issues, logRotation.issues);
  var critCount = 0;
  var warnCount = 0;
  for (var i = 0; i < allIssues.length; i++) {
    if (allIssues[i].indexOf("CRITICAL") === 0) { critCount++; }
    else if (allIssues[i].indexOf("WARNING") === 0) { warnCount++; }
  }

  lines.push("=== Ghost Engine Health Report ===");
  lines.push("Generated: " + NOW.toISOString());
  lines.push("Status: " + (critCount > 0 ? "CRITICAL" : warnCount > 0 ? "WARNING" : "HEALTHY"));
  lines.push("");

  lines.push("--- PM2 Processes ---");
  if (pm2Status.available) {
    for (var i = 0; i < pm2Status.processes.length; i++) {
      var p = pm2Status.processes[i];
      lines.push("  " + p.name + ": " + p.status + " (pid=" + p.pid + ", restarts=" + p.restarts + ", mem=" + Math.round(p.memory / 1024 / 1024) + "MB)");
    }
  } else {
    lines.push("  PM2 not available");
  }
  lines.push("");

  lines.push("--- Heartbeat Schedule ---");
  for (var i = 0; i < heartbeats.beats.length; i++) {
    var b = heartbeats.beats[i];
    lines.push("  " + b.label + " (" + b.name + "): " + b.status + (b.lastRun ? " [last: " + b.lastRun + "]" : ""));
  }
  lines.push("");

  lines.push("--- Log Scan ---");
  lines.push("  Files scanned: " + logScan.scanned);
  lines.push("  Critical matches: " + logScan.matches.length);
  if (logScan.matches.length > 0) {
    for (var i = 0; i < Math.min(logScan.matches.length, 10); i++) {
      var m = logScan.matches[i];
      lines.push("    [" + m.pattern + "] " + m.file + ": " + m.line);
    }
  }
  lines.push("");

  lines.push("--- Disk Space ---");
  if (diskSpace.available && diskSpace.info) {
    lines.push("  Usage: " + diskSpace.info.usePercent + " (" + diskSpace.info.used + " of " + diskSpace.info.size + ")");
  } else {
    lines.push("  Disk space check unavailable");
  }
  lines.push("");

  if (allIssues.length > 0) {
    lines.push("--- Issues (" + allIssues.length + ") ---");
    for (var i = 0; i < allIssues.length; i++) {
      lines.push("  " + allIssues[i]);
    }
  } else {
    lines.push("--- No Issues Detected ---");
  }
  lines.push("");

  return lines.join("\n");
}

function main() {
  console.log("[" + NOW.toISOString() + "] Production Log Monitor starting...");

  ensureDir(LOGS_DIR);
  ensureDir(DAILY_DIR);

  var pm2Status = getPm2Status();
  var heartbeats = checkHeartbeats();
  var logScan = scanLogsForCritical();
  var diskSpace = checkDiskSpace();
  var logRotation = checkLogRotation();

  var report = generateReport(pm2Status, heartbeats, logScan, diskSpace, logRotation);

  try {
    fs.writeFileSync(REPORT_PATH, report);
    console.log("Health report written to: " + REPORT_PATH);
  } catch (e) {
    console.error("Failed to write health report: " + (e.message || "unknown"));
  }

  var dailyReport = path.join(DAILY_DIR, TODAY + "-health-report.txt");
  try {
    fs.writeFileSync(dailyReport, report);
    console.log("Daily report written to: " + dailyReport);
  } catch (e) {
    console.error("Failed to write daily report: " + (e.message || "unknown"));
  }

  console.log("\n" + report);
  console.log("[" + NOW.toISOString() + "] Production Log Monitor complete.");
}

main();
