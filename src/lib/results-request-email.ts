import { cleanRobotName } from "@/lib/mt5-reminder-email";

// Words for the "how is it going, share your results" email. It asks for
// results, not profits: nobody knows who is up or down, and a note that only
// invites wins is awkward for everyone else and tilts what comes back. It
// restates nothing about performance, offers nothing in return, and says
// plainly that replying is not permission to publish. Plain text throughout:
// mail.ts renders the same lines as HTML and as the text part.

export type ResultsRequestContent = {
  subject: string;
  eyebrow: string;
  title: string;
  intro: string;
  detailLines: string[];
  buttonLabel: string;
  /** A mailto: link, so the button opens a reply to the support address. */
  buttonUrl: string;
};

export type ResultsRequestContentInput = {
  robotName: string;
  /** Whole days since the first build was ready. */
  daysWithRobot: number;
  /** The address replies go to (the address the email is sent from). */
  replyAddress: string;
};

export function buildResultsRequestContent(input: ResultsRequestContentInput): ResultsRequestContent {
  const robot = cleanRobotName(input.robotName);
  const days = input.daysWithRobot;
  const ready = days <= 1 ? "a day" : days <= 30 ? `${days} days` : "a while";

  return {
    subject: `How is ${robot} working out for you?`,
    eyebrow: "Your results",
    title: `How is ${robot} going?`,
    intro: `Your ${robot} build has been ready for ${ready}, so we would like to hear how it is going.`,
    detailLines: [
      "Reply to this email with a screenshot of your results from MT5 (the History tab or your equity curve works well) and a line about how it has gone.",
      "Good days, bad days and questions are all welcome. If something is not working as you expected, tell us and we will help.",
      "Hide your account number if you like. Replying does not give us permission to publish anything. If you are happy for us to share your results, say so in your reply and we will confirm with you before we do.",
      "Results differ from one account to the next, and past results are no guide to future ones.",
    ],
    buttonLabel: "Reply with my results",
    buttonUrl: `mailto:${input.replyAddress}?subject=${encodeURIComponent("My GoldBot results")}`,
  };
}
