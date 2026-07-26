#!/usr/bin/env node
/* Compile-contract validator. Run BEFORE any release upload:
 *   node scripts/check-robot-source.js robots/<slug>/MASTER.mq5
 * Exit 0 = source satisfies the daemon's injection contract.
 */
const fs = require("fs");

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/check-robot-source.js <path.mq5>");
  process.exit(2);
}
const src = fs.readFileSync(file, "utf8");

// These regexes MIRROR autocompiler-daemon/daemon-v2.js — keep in sync.
const CHECKS = [
  ["AccountProtectON flag", /bool\s+AccountProtectON\s*=\s*\w+\s*;/],
  ["allowed_accounts array", /const\s+long\s+allowed_accounts\[\]\s*=\s*\{[^}]*\}\s*;/],
  ["ExpiredON flag", /bool\s+ExpiredON\s*=\s*\w+\s*;/],
  ["ExpiredTime datetime", /datetime\s+ExpiredTime\s*=\s*D'[^']*'\s*;/],
  ["OnInit gate uses AccountProtectON", /if\s*\(\s*AccountProtectON/],
  ["OnInit gate uses ExpiredON", /if\s*\(\s*ExpiredON/],
];

let failed = 0;
for (const [name, re] of CHECKS) {
  const ok = re.test(src);
  console.log(`${ok ? "  OK " : "FAIL "} ${name}`);
  if (!ok) failed++;
}

// Comment-base rule: underscores are reserved for `_1_R`/`_2_R` suffixes.
const commentBases = src.match(/Comment\w*\s*=\s*"([^"]*)"/g) || [];
for (const m of commentBases) {
  const val = m.split('"')[1] || "";
  if (val.includes("_")) {
    console.log(`FAIL  comment base contains underscore: ${m}`);
    failed++;
  }
}

if (failed) {
  console.error(`\n${failed} contract violation(s) — daemon injection would silently miss. NOT safe to release.`);
  process.exit(1);
}
console.log("\nContract satisfied — safe to release.");
