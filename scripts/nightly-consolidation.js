"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function safeReadFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
    console.log("[WARN] File not found: " + filePath);
    return null;
  } catch (err) {
    console.log("[ERROR] Failed to read " + filePath + ": " + err.message);
    return null;
  }
}

function safeWriteFile(filePath, content) {
  try {
    var dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, "utf-8");
    return true;
  } catch (err) {
    console.log("[ERROR] Failed to write " + filePath + ": " + err.message);
    return false;
  }
}

function parseCsv(raw) {
  var lines = raw.trim().split("\n");
  if (lines.length < 2) {
    return [];
  }
  var headers = lines[0].split(",").map(function (h) {
    return h.trim();
  });
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var vals = lines[i].split(",");
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = (vals[j] || "").trim();
    }
    rows.push(row);
  }
  return rows;
}

function todayStr() {
  var d = new Date();
  var yyyy = d.getFullYear();
  var mm = String(d.getMonth() + 1).padStart(2, "0");
  var dd = String(d.getDate()).padStart(2, "0");
  return yyyy + "-" + mm + "-" + dd;
}

function main() {
  var today = todayStr();
  console.log("=== Ghost Engine Nightly Consolidation ===");
  console.log("Date: " + today);
  console.log("");

  // --- Read data sources ---
  var crmPath = path.join(ROOT, "leads", "crm.csv");
  var huntLogPath = path.join(ROOT, "leads", "daily-hunt-log.csv");
  var metricsPath = path.join(ROOT, "leads", "metrics-snapshot.txt");
  var identityPath = path.join(ROOT, "system", "IDENTITY.md");

  var crmRaw = safeReadFile(crmPath);
  var huntLogRaw = safeReadFile(huntLogPath);
  var metricsRaw = safeReadFile(metricsPath);
  var identityRaw = safeReadFile(identityPath);

  // --- Parse CRM ---
  var crmRows = crmRaw ? parseCsv(crmRaw) : [];
  console.log("CRM rows loaded: " + crmRows.length);

  // --- Parse metrics snapshot ---
  var metrics = {};
  if (metricsRaw) {
    try {
      metrics = JSON.parse(metricsRaw);
    } catch (err) {
      console.log("[WARN] Could not parse metrics-snapshot.txt: " + err.message);
    }
  }

  // --- Compute KPIs ---
  var leadsPerDay = 0;
  var conversationsPerDay = 0;
  var totalPipeline = crmRows.length;
  var closedWon = 0;

  for (var i = 0; i < crmRows.length; i++) {
    var row = crmRows[i];

    // leadsPerDay: rows where timestamp contains today
    if (row.timestamp && row.timestamp.indexOf(today) !== -1) {
      leadsPerDay++;
    }

    // conversationsPerDay: status === "contacted" OR dms_sent > 0
    var statusLower = (row.status || "").toLowerCase();
    var dmsSent = parseInt(row.dms_sent, 10);
    if (statusLower === "contacted" || (!isNaN(dmsSent) && dmsSent > 0)) {
      conversationsPerDay++;
    }

    // closedWon
    if (statusLower === "closed-won") {
      closedWon++;
    }
  }

  var callsBookedThisWeek = Number(metrics.bookedCalls) || 0;
  var revenue = Number(metrics.revenue) || 0;
  var firstClose = closedWon > 0 ? "Yes" : "Not yet";

  console.log("");
  console.log("--- Computed KPIs ---");
  console.log("Leads scored today:        " + leadsPerDay);
  console.log("Conversations started:     " + conversationsPerDay);
  console.log("Calls booked this week:    " + callsBookedThisWeek);
  console.log("Revenue closed:            $" + revenue);
  console.log("Pipeline depth:            " + totalPipeline);
  console.log("Closed-won deals:          " + closedWon);
  console.log("First close achieved:      " + firstClose);
  console.log("");

  // --- Status emoji helper ---
  function statusIcon(current, target) {
    return current >= target ? "\u2705" : "\u274c";
  }

  // --- Build KPI table ---
  var kpiBlock = "";
  kpiBlock += "### Current KPI Status (auto-updated " + today + ")\n";
  kpiBlock += "\n";
  kpiBlock += "| KPI | Target | Current | Status |\n";
  kpiBlock += "|---|---|---|---|\n";
  kpiBlock += "| New leads scored/day | 5+ | " + leadsPerDay + " | " + statusIcon(leadsPerDay, 5) + " |\n";
  kpiBlock += "| Conversations started/day | 3+ | " + conversationsPerDay + " | " + statusIcon(conversationsPerDay, 3) + " |\n";
  kpiBlock += "| Discovery calls booked/week | 1+ | " + callsBookedThisWeek + " | " + statusIcon(callsBookedThisWeek, 1) + " |\n";
  kpiBlock += "| Revenue closed | >$0 | $" + revenue + " | " + statusIcon(revenue, 1) + " |\n";
  kpiBlock += "| Pipeline depth | 10+ | " + totalPipeline + " | " + statusIcon(totalPipeline, 10) + " |\n";

  // --- Update IDENTITY.md ---
  if (identityRaw) {
    var sectionHeader = "## How I Know I'm Winning";
    var sectionIndex = identityRaw.indexOf(sectionHeader);

    if (sectionIndex === -1) {
      console.log("[WARN] Section \"## How I Know I'm Winning\" not found in IDENTITY.md");
      console.log("       Appending KPI block at end of file.");
      var updatedIdentity = identityRaw.trimEnd() + "\n\n" + sectionHeader + "\n\n" + kpiBlock;
      safeWriteFile(identityPath, updatedIdentity);
    } else {
      // Find insertion point after the section header line
      var afterHeader = identityRaw.indexOf("\n", sectionIndex);
      if (afterHeader === -1) {
        afterHeader = identityRaw.length;
      } else {
        afterHeader += 1; // move past the newline
      }

      // Find the next ## section to know where this section ends
      var nextSectionMatch = identityRaw.indexOf("\n## ", afterHeader);
      var sectionEnd = nextSectionMatch !== -1 ? nextSectionMatch : identityRaw.length;

      // Check if there is an existing "### Current KPI Status" sub-section
      var existingKpiStart = identityRaw.indexOf("### Current KPI Status", sectionIndex);

      if (existingKpiStart !== -1 && existingKpiStart < sectionEnd) {
        // Replace existing KPI sub-section
        var kpiEnd = sectionEnd;
        var nextSubSection = identityRaw.indexOf("\n### ", existingKpiStart + 1);
        var nextMainSection = identityRaw.indexOf("\n## ", existingKpiStart + 1);

        if (nextSubSection !== -1 && nextSubSection < kpiEnd) {
          kpiEnd = nextSubSection;
        }
        if (nextMainSection !== -1 && nextMainSection < kpiEnd) {
          kpiEnd = nextMainSection;
        }

        var updatedIdentity = identityRaw.substring(0, existingKpiStart) + kpiBlock + identityRaw.substring(kpiEnd);
        safeWriteFile(identityPath, updatedIdentity);
      } else {
        // Insert KPI block after section header content
        var updatedIdentity = identityRaw.substring(0, afterHeader) + "\n" + kpiBlock + identityRaw.substring(afterHeader);
        safeWriteFile(identityPath, updatedIdentity);
      }
    }
    console.log("IDENTITY.md updated with KPI status.");
  } else {
    console.log("[WARN] IDENTITY.md not available. Skipping update.");
  }

  // --- Update metrics-snapshot.txt ---
  var updatedMetrics = {
    date: today,
    weekLeads: Number(metrics.weekLeads) || 0,
    todayLeads: leadsPerDay,
    bookedCalls: callsBookedThisWeek,
    closes: closedWon,
    revenue: revenue,
    pipeline: totalPipeline,
    impliedPipeline: Number(metrics.impliedPipeline) || 0
  };

  var metricsJson = JSON.stringify(updatedMetrics, null, 2);
  if (safeWriteFile(metricsPath, metricsJson)) {
    console.log("metrics-snapshot.txt updated.");
  }

  console.log("");
  console.log("=== Nightly consolidation complete ===");
}

main();
