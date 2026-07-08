// Landing data builders shared between the homepage (proof metrics) and the
// /features detail page (feature panels, execution flow, ops pillars, compare
// rows). Extracted from page.tsx so both can render without duplicating data.
type Translate = (key: string) => string;

export const getProofMetrics = (t: Translate) => [
  { value: "< 15s", label: t("metric1Label"), detail: t("metric1Detail") },
  { value: "1:1", label: t("metric2Label"), detail: t("metric2Detail") },
  { value: "24/7", label: t("metric3Label"), detail: t("metric3Detail") },
];

export const getFeaturePanels = (t: Translate) => [
  {
    eyebrow: t("adaptiveRecovery"),
    title: t("adaptiveRecoveryTitle"),
    body: t("adaptiveRecoveryBody"),
    bullets: [t("structuredHedge"), t("drawdownAware"), t("cleanerPropFirm")],
    glyph: "signal",
    layout: "feature-panel-large",
  },
  {
    eyebrow: t("liquidityGuard"),
    title: t("liquidityGuardTitle"),
    body: t("liquidityGuardBody"),
    bullets: [t("bankHoliday"), t("sessionAware")],
    glyph: "shield",
    layout: "feature-panel-tall",
  },
  {
    eyebrow: t("privateBuild"),
    title: t("privateBuildTitle"),
    body: t("privateBuildBody"),
    bullets: [t("accountSpecific"), t("noLaggy")],
    glyph: "vault",
    layout: "feature-panel-compact",
  },
  {
    eyebrow: t("executionCharacter"),
    title: t("executionCharacterTitle"),
    body: t("executionCharacterBody"),
    bullets: [t("fastDeployment"), t("clearSetup"), t("mt5Native")],
    glyph: "halo",
    layout: "feature-panel-wide",
  },
];

export const getExecutionFlow = (t: Translate) => [
  { title: t("flow1Title"), copy: t("flow1Copy"), eta: t("flow1Eta"), glyph: "wallet" },
  { title: t("flow2Title"), copy: t("flow2Copy"), eta: t("flow2Eta"), glyph: "halo" },
  { title: t("flow3Title"), copy: t("flow3Copy"), eta: t("flow3Eta"), glyph: "vault" },
  { title: t("flow4Title"), copy: t("flow4Copy"), eta: t("flow4Eta"), glyph: "signal" },
  { title: t("flow5Title"), copy: t("flow5Copy"), eta: t("flow5Eta"), glyph: "launch" },
];

export const getOpsPillars = (t: Translate) => [
  { title: t("ops1Title"), copy: t("ops1Copy"), glyph: "shield" },
  { title: t("ops2Title"), copy: t("ops2Copy"), glyph: "vault" },
  { title: t("ops3Title"), copy: t("ops3Copy"), glyph: "launch" },
];

export const getCompareRows = (t: Translate) => [
  { capability: t("comp1Cap"), goldbot: t("comp1Gb"), typical: t("comp1Typ") },
  { capability: t("comp2Cap"), goldbot: t("comp2Gb"), typical: t("comp2Typ") },
  { capability: t("comp3Cap"), goldbot: t("comp3Gb"), typical: t("comp3Typ") },
  { capability: t("comp4Cap"), goldbot: t("comp4Gb"), typical: t("comp4Typ") },
];
