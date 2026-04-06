"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");

const ROOT = path.resolve(__dirname, "..");
const LOGS_DIR = path.join(ROOT, "logs");
const PM2_LOGS_DIR = path.join(os.homedir(), ".pm2", "logs");
const REPORT_PATH = path.join(LOGS_DIR, "health-report.txt");

const KNOWN_PROCESSES = ["ghost-engine", "heartbeat-0730", "heartbeat-0900", "heartbeat-1100", "heartbeat-2300"];

const HEARTBEATS = {
  "heartbeat-0730": { cronTime: "7:30 AM ET", desc: "morning engagement check", tz: "America/New_York" },
  "heartbeat-0900": { cronTime: "9:00 AM ET", desc: "outreach batch", tz: "America/New_York" },
  "heartbeat-1100": { cronTime: "11:00 AM ET", desc: "content posting", tz: "America/New_York" },
  "heartbeat-2300": { cronTime: "11:00 PM ET", desc: "nightly cleanup", tz: "America/New_York" }
};

const CRITICAL_PATTERNS = ["uncaughtException", "ECONNREFUSED", "ENOMEM", "heap out of memory", "FATAL", "unhandledRejection"];
const MAX_LOG_SIZE = 100 * 1024 * 1024;
const MISSED_THRESHOLD_MS = 25 * 60 * 60 * 1000;
const RECENCY_MS = 24 * 60 * 60 * 1000;

function checkPm2Processes() {
  var res = { available: false, processes: [], warnings: [], errors: [] };
  try {
    var raw = execSync("pm2 jlist", { encoding: "utf8", timeout: 15000, stdio: ["pipe", "pipe", "pipe"] });
    var list;
    try { list = JSON.parse(raw); } catch (e) { res.errors.push("Failed to parse PM2 output: " + e.message); return res; }
    res.available = true;
    if (!Array.isArray(list) || list.length === 0) { res.warnings.push("PM2 running but no processes found"); return res; }
    var found = [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var name = p.name || "unknown";
      var status = (p.pm2_env && p.pm2_env.status) || "unknown";
      var restarts = (p.pm2_env && p.pm2_env.restart_time) || 0;
      var uptime = (p.pm2_env && p.pm2_env.pm_uptime) || 0;
      var mem = (p.monit && p.monit.memory) || 0;
      found.push(name);
      var uptimeH = uptime > 0 ? Math.round((Date.now() - uptime) / 3600000 * 10) / 10 : 0;
      var memMB = Math.round(mem / 1048576 * 10) / 10;
      res.processes.push({ name: name, pid: p.pid || "N/A", status: status, restarts: restarts, uptimeH: uptimeH, memMB: memMB });
      if (status === "stopped" || status === "errored") { res.errors.push("Process " + name + " is " + status); }
      if (restarts > 5) { res.warnings.push(name + " restarted " + restarts + " times (threshold: 5)"); }
      else if (restarts > 3) { res.warnings.push(name + " elevated restarts: " + restarts); }
    }
    for (var k = 0; k < KNOWN_PROCESSES.length; k++) {
      if (found.indexOf(KNOWN_PROCESSES[k]) === -1) { res.errors.push("Expected process not found: " + KNOWN_PROCESSES[k]); }
    }
  } catch (err) {
    if (err.message && err.message.indexOf("ENOENT") !== -1) { res.warnings.push("PM2 is not installed or not in PATH"); }
    else { res.warnings.push("PM2 check failed: " + (err.message || String(err))); }
  }
  return res;
}

function checkHeartbeats() {
  var res = { beats: {}, warnings: [], errors: [] };
  var now = Date.now();
  var names = Object.keys(HEARTBEATS);
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    var cfg = HEARTBEATS[name];
    var beat = { name: name, cronTime: cfg.cronTime, description: cfg.desc, lastSeen: null, logFileExists: false, logFileModified: null, status: "unknown" };
    var lastExec = null;
    var pm2Logs = [path.join(PM2_LOGS_DIR, name + "-out.log"), path.join(PM2_LOGS_DIR, name + "-error.log")];
    for (var j = 0; j < pm2Logs.length; j++) {
      try {
        if (fs.existsSync(pm2Logs[j])) {
          var mt = fs.statSync(pm2Logs[j]).mtime.getTime();
          if (!lastExec || mt > lastExec) { lastExec = mt; }
        }
      } catch (e) { /* ignore */ }
    }
    try {
      if (fs.existsSync(LOGS_DIR)) {
        var files = fs.readdirSync(LOGS_DIR);
        for (var f = 0; f < files.length; f++) {
          if (files[f].indexOf(name) !== -1) {
            var fp = path.join(LOGS_DIR, files[f]);
            try {
              var st = fs.statSync(fp);
              beat.logFileExists = true;
              var mt2 = st.mtime.getTime();
              beat.logFileModified = new Date(mt2).toISOString();
              if (!lastExec || mt2 > lastExec) { lastExec = mt2; }
            } catch (e) { /* ignore */ }
          }
        }
      }
    } catch (e) { res.warnings.push("Cannot scan logs dir for " + name + ": " + e.message); }
    if (lastExec) {
      beat.lastSeen = new Date(lastExec).toISOString();
      var elapsed = now - lastExec;
      if (elapsed > MISSED_THRESHOLD_MS) {
        beat.status = "missed";
        res.errors.push(name + " (" + cfg.desc + ") no execution in " + Math.round(elapsed / 3600000) + "h (threshold: 25h)");
      } else { beat.status = "ok"; }
    } else {
      beat.status = "no-evidence";
      res.warnings.push("No execution evidence for " + name + " (" + cfg.desc + ")");
    }
    if (!beat.logFileExists) { res.warnings.push("No log file in logs/ for " + name); }
    res.beats[name] = beat;
  }
  return res;
}

function scanApplicationLogs() {
  var res = { filesScanned: 0, totalErrors: 0, totalWarnings: 0, criticalPatterns: [], recentErrors: [], oversizedFiles: [], fileDetails: [], warnings: [], errors: [] };
  var now = Date.now();
  var dirs = [];
  if (fs.existsSync(LOGS_DIR)) { dirs.push(LOGS_DIR); }
  if (fs.existsSync(PM2_LOGS_DIR)) { dirs.push(PM2_LOGS_DIR); }
  if (dirs.length === 0) { res.warnings.push("No log directories found"); return res; }
  for (var d = 0; d < dirs.length; d++) {
    var files;
    try { files = fs.readdirSync(dirs[d]); } catch (e) { res.warnings.push("Cannot read " + dirs[d] + ": " + e.message); continue; }
    for (var f = 0; f < files.length; f++) {
      if (!files[f].endsWith(".log") && !files[f].endsWith(".txt")) { continue; }
      var fp = path.join(dirs[d], files[f]);
      var stat;
      try { stat = fs.statSync(fp); } catch (e) { continue; }
      if (!stat.isFile()) { continue; }
      if (stat.size > MAX_LOG_SIZE) { res.oversizedFiles.push({ path: fp, sizeMB: Math.round(stat.size / 1048576) }); }
      if (now - stat.mtime.getTime() > RECENCY_MS) { continue; }
      res.filesScanned++;
      var info = { path: fp, sizeMB: Math.round(stat.size / 1048576 * 100) / 100, modified: stat.mtime.toISOString(), errorCount: 0, warnCount: 0, criticalHits: [] };
      try {
        var content = fs.readFileSync(fp, "utf8");
        var lines = content.split("\n");
        var errLines = [];
        for (var li = 0; li < lines.length; li++) {
          var line = lines[li];
          var upper = line.toUpperCase();
          if (upper.indexOf("ERROR") !== -1) { info.errorCount++; errLines.push(line.trim()); }
          if (upper.indexOf("WARN") !== -1) { info.warnCount++; }
          for (var cp = 0; cp < CRITICAL_PATTERNS.length; cp++) {
            if (line.indexOf(CRITICAL_PATTERNS[cp]) !== -1) {
              info.criticalHits.push(CRITICAL_PATTERNS[cp]);
              if (res.criticalPatterns.indexOf(CRITICAL_PATTERNS[cp]) === -1) { res.criticalPatterns.push(CRITICAL_PATTERNS[cp]); }
            }
          }
        }
        var last10 = errLines.slice(-10);
        for (var e = 0; e < last10.length; e++) { res.recentErrors.push({ file: files[f], line: last10[e].substring(0, 500) }); }
        res.totalErrors += info.errorCount;
        res.totalWarnings += info.warnCount;
      } catch (readErr) { res.warnings.push("Cannot read " + fp + ": " + readErr.message); }
      res.fileDetails.push(info);
    }
  }
  if (res.recentErrors.length > 10) { res.recentErrors = res.recentErrors.slice(-10); }
  return res;
}

function determineStatus(pm2, hb, logs) {
  if (pm2.errors.length > 0) { return "CRITICAL"; }
  var missed = Object.keys(hb.beats).filter(function (k) { return hb.beats[k].status === "missed"; });
  if (missed.length > 1) { return "CRITICAL"; }
  if (logs.criticalPatterns.length > 0) { return "CRITICAL"; }
  if (pm2.warnings.length > 0) { return "DEGRADED"; }
  if (hb.warnings.length > 0 || hb.errors.length > 0) { return "DEGRADED"; }
  if (missed.length === 1) { return "DEGRADED"; }
  if (logs.totalErrors > 0 || logs.oversizedFiles.length > 0 || logs.warnings.length > 0) { return "DEGRADED"; }
  return "HEALTHY";
}

function generateReport() {
  var startTime = Date.now();
  console.log("========================================");
  console.log("  Production Log Monitor - ghost-engine");
  console.log("========================================\n");

  console.log("[1/4] Checking PM2 processes...");
  var pm2 = checkPm2Processes();
  console.log("[2/4] Verifying heartbeat cron execution...");
  var hb = checkHeartbeats();
  console.log("[3/4] Scanning application logs...");
  var logs = scanApplicationLogs();
  console.log("[4/4] Generating health report...\n");

  var status = determineStatus(pm2, hb, logs);
  var duration = Date.now() - startTime;
  var ts = new Date().toISOString();

  var report = { timestamp: ts, checkDurationMs: duration, overallStatus: status, pm2: pm2, heartbeats: hb, logs: logs };
  var sep = "============================================================";
  var sep2 = "------------------------------------------------------------";
  var out = [];
  out.push(sep);
  out.push("PRODUCTION HEALTH REPORT - ghost-engine");
  out.push(sep);
  out.push("Timestamp:      " + ts);
  out.push("Check Duration: " + duration + "ms");
  out.push("Overall Status: " + status);
  out.push("");
  out.push(sep2);
  out.push("PM2 PROCESS STATUS");
  out.push(sep2);
  if (!pm2.available) { out.push("  PM2 not available"); }
  else if (pm2.processes.length === 0) { out.push("  No processes found"); }
  else {
    for (var i = 0; i < pm2.processes.length; i++) {
      var p = pm2.processes[i];
      out.push("  " + p.name + " | status=" + p.status + " | pid=" + p.pid + " | restarts=" + p.restarts + " | uptime=" + p.uptimeH + "h | mem=" + p.memMB + "MB");
    }
  }
  for (var i = 0; i < pm2.warnings.length; i++) { out.push("  [WARN] " + pm2.warnings[i]); }
  for (var i = 0; i < pm2.errors.length; i++) { out.push("  [ERROR] " + pm2.errors[i]); }
  out.push("");
  out.push(sep2);
  out.push("HEARTBEAT CRON STATUS");
  out.push(sep2);
  var bkeys = Object.keys(hb.beats);
  for (var i = 0; i < bkeys.length; i++) {
    var b = hb.beats[bkeys[i]];
    out.push("  " + b.name + " | " + b.cronTime + " | status=" + b.status + " | last=" + (b.lastSeen || "never"));
    out.push("    " + b.description + (b.logFileExists ? " | log modified: " + b.logFileModified : " | no log file"));
  }
  for (var i = 0; i < hb.warnings.length; i++) { out.push("  [WARN] " + hb.warnings[i]); }
  for (var i = 0; i < hb.errors.length; i++) { out.push("  [ERROR] " + hb.errors[i]); }
  out.push("");
  out.push(sep2);
  out.push("APPLICATION LOG SCAN");
  out.push(sep2);
  out.push("  Files scanned:     " + logs.filesScanned);
  out.push("  Total errors:      " + logs.totalErrors);
  out.push("  Total warnings:    " + logs.totalWarnings);
  out.push("  Critical patterns: " + (logs.criticalPatterns.length > 0 ? logs.criticalPatterns.join(", ") : "none"));
  for (var i = 0; i < logs.oversizedFiles.length; i++) { out.push("  [OVERSIZE] " + logs.oversizedFiles[i].path + " (" + logs.oversizedFiles[i].sizeMB + "MB)"); }
  for (var i = 0; i < logs.fileDetails.length; i++) {
    var fd = logs.fileDetails[i];
    out.push("  " + fd.path + " (" + fd.sizeMB + "MB) errors=" + fd.errorCount + " warns=" + fd.warnCount + (fd.criticalHits.length > 0 ? " CRITICAL:" + fd.criticalHits.join(",") : ""));
  }
  if (logs.recentErrors.length > 0) {
    out.push("  Last error lines:");
    for (var i = 0; i < logs.recentErrors.length; i++) { out.push("    [" + logs.recentErrors[i].file + "] " + logs.recentErrors[i].line); }
  }
  out.push("");
  out.push(sep);
  out.push("OVERALL STATUS: " + status);
  out.push(sep);

  var reportText = out.join("\n");
  try {
    if (!fs.existsSync(LOGS_DIR)) { fs.mkdirSync(LOGS_DIR, { recursive: true }); }
    fs.writeFileSync(REPORT_PATH, reportText, "utf8");
    console.log("Report written to: " + REPORT_PATH);
  } catch (e) { console.error("Failed to write report: " + e.message); }
  console.log("");
  console.log(reportText);
  return { status: status, report: report };
}

if (require.main === module) {
  var result = generateReport();
  process.exit(result.status === "HEALTHY" ? 0 : 1);
}

module.exports = {
  checkPm2Processes: checkPm2Processes,
  checkHeartbeats: checkHeartbeats,
  scanApplicationLogs: scanApplicationLogs,
  generateReport: generateReport
};
