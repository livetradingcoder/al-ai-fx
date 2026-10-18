// Who may read a tutorial. Each help article carries an `access` level
// (tutorial-articles.ts) and the three numbered setup tutorials share
// LEGACY_ACCESS (tutorials/legacy.ts); the pages ask tutorialGate() instead of
// repeating the rule, so moving an article between the two levels is a
// one-word change.
//
//   public  - readable signed out, indexed by search engines, in the sitemap.
//             Anything useful before buying or without a licence.
//   members - operating the product after purchase, or tied to the account.
//             Signed-out visitors are sent to the login and come back to it.

import { buildLoginRedirectPath } from "@/lib/auth-redirects";
import { buildLocalizedPath } from "@/lib/seo";

export type TutorialAccess = "public" | "members";

export type TutorialGate = "show" | "login" | "not-found";

/** What to do with a request for a tutorial: show it, send the visitor to log in, or 404. */
export function tutorialGate(access: TutorialAccess | undefined, signedIn: boolean): TutorialGate {
  if (!access) return "not-found";
  return access === "public" || signedIn ? "show" : "login";
}

/** Where a signed-out visitor goes to read a members-only tutorial: the login, returning to it. */
export function tutorialLoginPath(locale: string, id: string): string {
  return buildLoginRedirectPath(locale, buildLocalizedPath(locale, `/tutorials/${id}`));
}
