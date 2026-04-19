const fs = require('fs');

const enFilePath = 'src/messages/en.json';
const en = JSON.parse(fs.readFileSync(enFilePath, 'utf8'));

en.FAQ = {
  title: "Frequently Asked Questions",
  subtitle: "Everything you need to know about GoldBot and the AL-ai-FX platform.",
  stillHaveQuestions: "Still have questions?",
  contactSupport: "Contact Support",
  q1: "How does the cloud compilation work?",
  a1: "Once you purchase a subscription and enter your MT5 account number in your Dashboard, our dedicated Windows Cloud Service dynamically modifies the source code of the EA and runs the MetaEditor compiler. This ensures the output .ex5 file is totally unique and locked securely to your account for maximum performance without lag-inducing web-requests.",
  q2: "Can I use the EA on multiple accounts?",
  a2: "Each subscription tier typically ties to one MT5 account to prevent unauthorized distribution. However, you can change your registered MT5 Account ID from the Dashboard up to 2 times a month.",
  q3: "What happens when my subscription expires?",
  a3: "The EA checks its embedded expiration date locally on instantiation. Once the date passes, the EA will stop opening new trades.",
  q4: "Does GoldBot handle Prop Firm rules?",
  a4: "Yes! With our Smart Hedging Mode and Global Liquidity Guard avoiding high-impact holidays, GoldBot is heavily optimized for Prop Firm passing and long-term funding."
};

// Also making sure Landing is not destroyed or skipped
if (!en.Landing) {
    en.Landing = {
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
    };
}

fs.writeFileSync(enFilePath, JSON.stringify(en, null, 2));
console.log("Updated en.json with FAQ keys");
