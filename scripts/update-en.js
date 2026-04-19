const fs = require('fs');

const enFilePath = 'src/messages/en.json';
const en = JSON.parse(fs.readFileSync(enFilePath, 'utf8'));

en.Landing = {
  ...en.Landing,
  metric1Label: "Personalized compile",
  metric1Detail: "From MT5 account lock to download-ready package.",
  metric2Label: "License binding",
  metric2Detail: "One GoldBot build per approved MT5 account.",
  metric3Label: "Automated ruleset",
  metric3Detail: "Execution logic that stays on plan around the clock.",
  
  adaptiveRecovery: "Adaptive Recovery",
  adaptiveRecoveryTitle: "Smart hedging that protects structure when the market gets violent.",
  adaptiveRecoveryBody: "Recovery logic is designed to react with discipline, not panic. GoldBot stays focused on position structure, exposure control, and controlled re-entry instead of brute-force escalation.",
  structuredHedge: "Structured hedge handling",
  drawdownAware: "Drawdown-aware exposure logic",
  cleanerPropFirm: "Cleaner prop-firm behavior",

  liquidityGuard: "Liquidity Guard",
  liquidityGuardTitle: "Holiday filters cut the dead hours before they damage performance.",
  liquidityGuardBody: "UK, US, DE, FR, and IT holiday conditions are screened automatically so the EA stays away from thin, distorted sessions.",
  bankHoliday: "Bank-holiday screening",
  sessionAware: "Session-aware execution",

  privateBuild: "Private Build",
  privateBuildTitle: "Cloud compiled for your account instead of shipped like public slop.",
  privateBuildBody: "GoldBot is compiled uniquely for the MT5 account you authorize, avoiding the usual slow web-request license traps inside the EA.",
  accountSpecific: "Account-specific executable",
  noLaggy: "No laggy in-bot license ping",

  executionCharacterTitle: "Built for traders who want calm automation, not noisy theatrics.",
  executionCharacterBody: "Every section of the product is aimed at disciplined execution: fast provisioning, clear risk posture, and a setup path that gets you live without chaos.",
  fastDeployment: "Fast deployment",
  clearSetup: "Clear setup path",
  mt5Native: "MT5-native workflow",

  "10DaysTitle": "10 Days",
  for10Days: "for 10 days",
  fastValidation: "Fast validation window",
  basicFeatureSet: "Basic feature set",
  standardRecovery: "Standard recovery profile",
  automatedDelivery: "Automated delivery",

  monthlyTitle: "Monthly",
  perMonth: "per month",
  bestPlaceToStart: "Best place to start",
  unlimitedDownloads: "Unlimited downloads",
  allStrategyFeatures: "All strategy features",

  biannualTitle: "Biannual",
  per6Months: "per 6 months",
  lowerMaintenance: "Lower maintenance cadence",
  priorityLiquidGuard: "Priority Liquid Guard",

  freeTrialTitle: "Free Trial",
  for3days: "for 3 days",
  shortHandsOn: "Short hands-on test",

  lifetimeTitle: "Lifetime",
  oneTime: "one-time",
  permanentAccess: "Permanent access",
  unlimitedSourceCopies: "Unlimited source copies",
  vipSetupSupport: "VIP setup support",

  flow1Title: "Choose a plan",
  flow1Copy: "Pick the access window that matches your trading cadence and clear checkout securely.",
  flow1Eta: "ETA 1 min",

  flow2Title: "Create dashboard access",
  flow2Copy: "Your dashboard account is provisioned immediately against the purchase email you used.",
  flow2Eta: "Instant",

  flow3Title: "Bind your MT5 account",
  flow3Copy: "Enter the MT5 account number that should own the build and keep licensing clean.",
  flow3Eta: "ETA 30 sec",

  flow4Title: "Compile in the cloud",
  flow4Copy: "GoldBot is compiled into a personalized executable package tuned to that approved account.",
  flow4Eta: "ETA < 15 sec",

  flow5Title: "Install and launch",
  flow5Copy: "Drop the file into MT5, attach it to chart, set your risk profile, and go live.",
  flow5Eta: "ETA 2 min",

  ops1Title: "Liquidity guard",
  ops1Copy: "Execution is restricted during low-liquidity holiday windows and fragile sessions.",
  ops2Title: "Account-level locking",
  ops2Copy: "Each build is tied to your MT5 account so licensing stays clean and distribution stays controlled.",
  ops3Title: "Fast deployment",
  ops3Copy: "Provisioning and compilation are engineered to be quick enough that setup does not drag on.",

  compHead1: "Capability",
  compHead2: "GoldBot",
  compHead3: "Typical public EA",
  
  comp1Cap: "Account-specific executable",
  comp1Gb: "Included by default",
  comp1Typ: "Rare or missing",

  comp2Cap: "Holiday liquidity protection",
  comp2Gb: "Built into the workflow",
  comp2Typ: "Usually manual",

  comp3Cap: "Provisioning speed",
  comp3Gb: "Ready in minutes",
  comp3Typ: "Hours or days",

  comp4Cap: "License integrity",
  comp4Gb: "Cloud compiled + account bound",
  comp4Typ: "Shared files and weak checks"
};

fs.writeFileSync(enFilePath, JSON.stringify(en, null, 2));
console.log("Updated en.json with missing Landing Page constants");
