const fs = require('fs');
const path = require('path');

// Utility to smartly replace text inside Next.js components
function replaceStrings(filePath, hookName, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Inject import if not present
  if (!content.includes('useTranslations') && content.includes('export default function')) {
    content = content.replace(/(import .* from "next\/link";|import {.*} from "lucide-react";)/, `$1\nimport { useTranslations } from "next-intl";`);
  }

  // Inject hook if not present
  if (!content.includes('const t = useTranslations') && content.includes('export default')) {
    // Basic heuristics for inserting at the top of the default export
    content = content.replace(/(export default (?:async )?function \w+\([^{]*\) {)/, `$1\n  const t = useTranslations("${hookName}");\n`);
  }

  // Exact replacements
  Object.entries(replacements).forEach(([key, val]) => {
     // A lot of React strings are plain text inside tags.
     // e.g., <h1>Hello</h1> -> <h1>{t('hello')}</h1>
     // If the val is an object, we use its key for t() and the value for en.json
     const searchStr = key;
     const translateKey = `{t('${val}')}`;
     content = content.split(searchStr).join(translateKey);
  });

  fs.writeFileSync(filePath, content);
}

// 1. Landing Page
replaceStrings('src/app/[locale]/page.tsx', 'Landing', {
  "AI-assisted MT5 execution engine": "heroEyebrow",
  "GoldBot — built for traders who want": "heroTitlePrefix",
  " disciplined automation, not dashboard theater.": "heroTitleSuffix",
  "GoldBot is an MT5 EA with account-bound cloud compilation, and risk-aware execution logic designed for controlled MetaTrader 5 deployment.": "heroSubtitle",
  "Get Access": "getAccess",
  "Watch Tutorials": "watchTutorials",
  "Execution Character": "executionCharacter",
  "Built for controlled deployment.": "builtForControlled",
  "Consistent decision rules, protective recovery logic, and account-level security are designed into the experience from the start.": "decisionRulesDetails",
  "Designed for performance": "designedForPerformance",
  "Built exclusively for": "builtExclusivelyFor",
  " MetaTrader 5.": "metaTraderSuffix"
});

// We will construct the en.json programmatically
const enJson = {
  "Navbar": {
    "brandPrefix": "GoldBot",
    "brandSuffix": "by AL-ai-FX",
    "features": "Features",
    "pricing": "Pricing",
    "tutorials": "Tutorials",
    "faq": "FAQ",
    "login": "Login",
    "getAccess": "Get Access"
  },
  "Landing": {
    "heroEyebrow": "AI-assisted MT5 execution engine",
    "heroTitlePrefix": "GoldBot — built for traders who want",
    "heroTitleSuffix": " disciplined automation, not dashboard theater.",
    "heroSubtitle": "GoldBot is an MT5 EA with account-bound cloud compilation, and risk-aware execution logic designed for controlled MetaTrader 5 deployment.",
    "getAccess": "Get Access",
    "watchTutorials": "Watch Tutorials",
    "executionCharacter": "Execution Character",
    "builtForControlled": "Built for controlled deployment.",
    "decisionRulesDetails": "Consistent decision rules, protective recovery logic, and account-level security are designed into the experience from the start.",
    "designedForPerformance": "Designed for performance",
    "builtExclusivelyFor": "Built exclusively for",
    "metaTraderSuffix": " MetaTrader 5."
  }
};

fs.writeFileSync('src/messages/en.json', JSON.stringify(enJson, null, 2));

console.log("English extraction mapped successfully.");
