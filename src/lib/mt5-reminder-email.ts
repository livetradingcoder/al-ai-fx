import type { ReminderKind } from "@/lib/mt5-reminder-schedule";

// Words for the "link your MT5 account" reminders. Everything here restates
// what the site already says about setup (the account number locks the build,
// it compiles in under 15 seconds) - no performance claims, no offers, and the
// only urgency is a real date. Plain text throughout: mail.ts renders the same
// lines as HTML and as the text part.

export type Mt5ReminderContent = {
  subject: string;
  eyebrow: string;
  title: string;
  intro: string;
  detailLines: string[];
  buttonLabel: string;
};

export type Mt5ReminderContentInput = {
  kind: ReminderKind;
  /** 1-based number of the reminder; past the last one it repeats the last. */
  stage: number;
  robotName: string;
  expiresAt: Date | null;
  siteUrl: string;
};

const BUTTON_LABEL = "Link my MT5 account";
const REPLY_LINE = "Stuck on a step? Reply to this email and we will help.";

/** "Fri, 16 Oct 2026, 14:05 UTC" - the same instant for every reader. */
export function formatUtc(date: Date): string {
  return `${new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(date)} UTC`;
}

/**
 * The name is typed by an admin and ends up inside HTML; none of these
 * characters belong in a robot's name.
 */
export function cleanRobotName(name: string): string {
  return name.replace(/[<>&"']/g, "").replace(/\s+/g, " ").trim() || "GoldBot";
}

export function buildMt5ReminderContent(input: Mt5ReminderContentInput): Mt5ReminderContent {
  const robot = cleanRobotName(input.robotName);
  const expiry = input.expiresAt ? formatUtc(input.expiresAt) : null;
  const access = expiry ? `Your access runs until ${expiry}.` : "Your access does not expire.";

  const steps = [
    "1. Open your dashboard with the button below.",
    "2. Enter your MT5 account number. Your build is locked to that account.",
    "3. Your personalised build compiles in under 15 seconds. Download it and install it in MT5.",
    `Install guide: ${input.siteUrl}/guides/install-ea-on-mt5`,
  ];

  if (input.kind === "trial") {
    if (input.stage <= 1) {
      return {
        subject: `Your ${robot} trial is waiting for an MT5 account`,
        eyebrow: "Trial",
        title: "Link your MT5 account to start your trial",
        intro: `You started a trial of ${robot}, but no MT5 account is linked yet, so your robot has not been built.`,
        detailLines: [...steps, expiry ? `Your trial runs until ${expiry}.` : access, REPLY_LINE],
        buttonLabel: BUTTON_LABEL,
      };
    }
    return {
      subject: `Your ${robot} trial ends soon`,
      eyebrow: "Trial ending soon",
      title: "Your trial ends soon and your robot is not built yet",
      intro: expiry
        ? `Your ${robot} trial ends on ${expiry}, and no MT5 account is linked yet. Link one now to use the time you have left.`
        : `Your ${robot} trial is about to end, and no MT5 account is linked yet. Link one now to use the time you have left.`,
      detailLines: [...steps, REPLY_LINE],
      buttonLabel: BUTTON_LABEL,
    };
  }

  if (input.stage <= 1) {
    return {
      subject: `Finish setting up ${robot}`,
      eyebrow: "Setup",
      title: "One step left: link your MT5 account",
      intro: `Your ${robot} licence is active, but no MT5 account is linked yet, so your robot has not been built.`,
      detailLines: [...steps, access, REPLY_LINE],
      buttonLabel: BUTTON_LABEL,
    };
  }
  if (input.stage === 2) {
    return {
      subject: `Your ${robot} licence is not set up yet`,
      eyebrow: "Setup",
      title: "Your licence is active but not set up",
      intro: `Your ${robot} licence is running, but there is still no MT5 account to build it for. Setting it up takes a couple of minutes.`,
      detailLines: [...steps, access, REPLY_LINE],
      buttonLabel: BUTTON_LABEL,
    };
  }
  return {
    subject: `Need a hand setting up ${robot}?`,
    eyebrow: "Setup help",
    title: "Need a hand with setup?",
    intro: `Your ${robot} licence is active, but no MT5 account has been linked yet. If something is in the way, reply to this email and tell us where you got stuck.`,
    detailLines: [...steps, access],
    buttonLabel: BUTTON_LABEL,
  };
}
