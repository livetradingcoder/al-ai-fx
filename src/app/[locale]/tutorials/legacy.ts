// The three original tutorials. Their words live in the message files, so
// they stay translated; the five settings screenshots are English captures.

import type { TutorialBlock } from "@/lib/tutorial-articles";

export const LEGACY_IDS = ["1", "2", "3"] as const;
export type LegacyId = (typeof LEGACY_IDS)[number];

export function isLegacyId(id: string): id is LegacyId {
  return (LEGACY_IDS as readonly string[]).includes(id);
}

export type LegacyKey =
  | "tut1Title" | "tut1Desc" | "tut1Duration"
  | "tut2Title" | "tut2Desc" | "tut2Duration"
  | "tut3Title" | "tut3Desc" | "tut3Duration"
  | "step1Title" | "step1Desc" | "step2Title" | "step2Desc"
  | "step3Title" | "step3Desc" | "step4Title" | "step4Desc1" | "step4Desc2"
  | "drawdownTitle" | "drawdownDesc" | "adjustLotTitle" | "adjustLotDesc"
  | "liquidityGuardTitle" | "liquidityGuardDesc" | "manualFxTitle" | "manualFxDesc"
  | "configFlagsTitle" | "configFlagsDesc";

type Translate = (key: LegacyKey) => string;

const BALANCE_SHOTS = [
  { label: "$100", file: "100usd.png" },
  { label: "$1,000", file: "1000usd.png" },
  { label: "$2,000", file: "2000usd.png" },
  { label: "$5,000", file: "5000uskd.png" },
  { label: "$10,000", file: "10000usd.png" },
];

export function legacyCard(id: LegacyId, t: Translate) {
  return {
    title: t(`tut${id}Title`),
    summary: t(`tut${id}Desc`),
    duration: t(`tut${id}Duration`),
  };
}

export function legacyBlocks(id: LegacyId, t: Translate): TutorialBlock[] {
  const heading = (key: LegacyKey, anchor: string): TutorialBlock => ({ type: "h2", id: anchor, text: t(key) });
  const paragraph = (key: LegacyKey): TutorialBlock => ({ type: "p", text: t(key) });

  switch (id) {
    case "1":
      return [
        heading("step1Title", "step-1"),
        paragraph("step1Desc"),
        heading("step2Title", "step-2"),
        paragraph("step2Desc"),
        heading("step3Title", "step-3"),
        paragraph("step3Desc"),
        heading("step4Title", "step-4"),
        paragraph("step4Desc1"),
        paragraph("step4Desc2"),
      ];
    case "2":
      return [
        heading("drawdownTitle", "drawdown"),
        paragraph("drawdownDesc"),
        heading("adjustLotTitle", "lot-size"),
        paragraph("adjustLotDesc"),
        ...BALANCE_SHOTS.map(
          (shot): TutorialBlock => ({
            type: "figure",
            src: `/tutorials/${shot.file}`,
            alt: `${shot.label} settings`,
            caption: `${shot.label} Balance Configuration`,
          }),
        ),
      ];
    case "3":
      return [
        heading("liquidityGuardTitle", "liquidity-guard"),
        paragraph("liquidityGuardDesc"),
        heading("manualFxTitle", "manual-fx"),
        paragraph("manualFxDesc"),
        heading("configFlagsTitle", "config-flags"),
        paragraph("configFlagsDesc"),
      ];
  }
}
