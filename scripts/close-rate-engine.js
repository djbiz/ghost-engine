#!/usr/bin/env node
/**
 * Ghost Engine - Close Rate Engine
 * Revenue Mirror + Binary Close + Money Gap + Payment Close
 * The closer - run on every sales call
 */

const fs = require("fs");
const path = require("path");

const CLOSE_LOG = "/home/workspace/Ghost-Monitization-Engine/scripts/close-log.jsonl";
const SCRIPTS_DIR = "/home/workspace/Ghost-Monitization-Engine/scripts";

const SCRIPTS = {
  revenue_mirror: `REVENUE MIRROR - Ask This First

Q: "If we dont fix this... how much do you think youre leaving on the table each month?"

[Let them answer. Write down the number.]

Q: "And how long has that been happening?"

[Let them answer.]

A: "So this isnt a cost. This is you plugging that leak."

[Pause.]

"Here is how we fix it. Lets map it out."`,

  money_gap: `MONEY GAP CLOSE - After Revenue Mirror

Q: "Youre losing [X] per month, right?"

A: "If we fix this for you in the next 30 days... thats [X] back in your pocket every month going forward."

Q: "So honest question - is this worth [investment] to get [X] per month back? Or do we just keep doing what we are doing?"

[Wait for answer.]`,

  binary_close: `BINARY CLOSE - End of Every Call

Look them in the eye (or on video):

"We can either build this now... or nothing changes in 90 days."

"Which one are you choosing?"

[If yes]
"Cool. Sending the link now. We start immediately."

[If hesitation]
"What is making you hesitate? Talk to me."`,

  payment_close: `PAYMENT CLOSE - After Binary Close

"Something to know - after you pay, I will be in your business within 24 hours."

"You ready for that?"

[Send payment link]

"You officially have a monetization engine now."`,

  objection_expensiv: `OBJECTION: Too Expensive

"Compared to doing nothing and leaving [X] per month on the table?"

"Or compared to hiring someone who doesnt know this space?"

"This pays for itself in 30 days."

[Pause.]

"Unless you have another option you are weighing?"`,

  objection_think: `OBJECTION: I Need to Think

"Of course. Just so Im clear - what is the thing you need to think about?"

"Is it the strategy? The investment? The timeline?"

[Get specific answer.]

"Let me make sure I answer that for you before you go."`,

  deal_stacker: `DEAL STACKING - Before Closing

[After they say yes to main offer]

"Actually - while we are here. One more thing."

"Most of our clients also run [Ghost Partner / Elite Partner]. We stay in, optimize, and scale monthly."

"For [X] more per month you get [specific benefit]. Want to stack that too?"

[If yes - add to deal. If no - take main offer and move on.]`
};

function showScript(name) {
  const key = name.toLowerCase().replace(/[^a-z_]/g, "");
  if (SCRIPTS[key]) {
    console.log(SCRIPTS[key]);
    logUse(key);
  } else {
    console.log("Available scripts:");
    Object.keys(SCRIPTS).forEach(k => console.log("  - " + k));
  }
}

function logUse(script) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    action: "script_used",
    script: script
  }) + "\n";
  fs.appendFileSync(CLOSE_LOG, entry, "utf8");
}

function reviewCalls() {
  if (!fs.existsSync(CLOSE_LOG)) {
    console.log("No close log yet.");
    return;
  }
  const lines = fs.readFileSync(CLOSE_LOG, "utf8").trim().split("\n").filter(Boolean);
  console.log(`\nTotal call entries: ${lines.length}`);
  const scripts = {};
  lines.forEach(line => {
    try {
      const e = JSON.parse(line);
      if (e.script) scripts[e.script] = (scripts[e.script] || 0) + 1;
    } catch {}
  });
  if (Object.keys(scripts).length) {
    console.log("Scripts used:");
    Object.entries(scripts).sort((a,b) => b[1]-a[1]).forEach(([k,c]) => {
      console.log(`  ${k}: ${c}x`);
    });
  }
}

const cmd = process.argv[2];
if (cmd === "review") {
  reviewCalls();
} else if (cmd === "test") {
  const script = process.argv[3] || "revenue_mirror";
  showScript(script);
} else {
  console.log("Usage:");
  console.log("  node close-rate-engine.js test [script_name]");
  console.log("  node close-rate-engine.js review");
  console.log("\nScripts:", Object.keys(SCRIPTS).join(", "));
}
