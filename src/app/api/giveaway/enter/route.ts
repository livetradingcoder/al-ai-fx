import { NextResponse } from "next/server";

import { enterGiveaway, getLiveGiveaway, type EntrySource } from "@/lib/giveaway";
import { sendGiveawayEntryEmail } from "@/lib/mail";
import { promoEligibilityForRequest } from "@/lib/promo-eligibility";
import { checkGiveawayRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { validateEmail } from "@/lib/validation";

const SOURCES: EntrySource[] = ["exit-intent", "page"];
const LOCALES = ["en", "hi", "bn", "ur", "ar", "de", "es"];

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * POST /api/giveaway/enter { email, source, locale, acceptRules, marketingOptIn, website? }
 *
 * Entering needs an email and agreement to the rules. Marketing email is a
 * separate, unticked-by-default choice and only changes the list when ticked.
 * Always answers the same way for a new and a repeat entry, so it can't be used
 * to find out who is on a list.
 */
export async function POST(req: Request) {
  const { success } = await checkGiveawayRateLimit(getClientIdentifier(req));
  if (!success) return reply({ ok: false, error: "Too many attempts. Please try again later." }, 429);

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    body = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return reply({ ok: false, error: "Invalid request." }, 400);
  }

  // Honeypot: a real visitor never sees this field.
  if (typeof body.website === "string" && body.website.trim() !== "") return reply({ ok: true });

  const locale = typeof body.locale === "string" && LOCALES.includes(body.locale) ? body.locale : null;
  const eligibility = await promoEligibilityForRequest(req, locale);
  if (!eligibility.eligible) {
    return reply({ ok: false, error: "The giveaway is not available in your region." }, 403);
  }

  if (typeof body.email !== "string") return reply({ ok: false, error: "Enter your email." }, 400);
  const validation = validateEmail(body.email);
  if (!validation.valid) return reply({ ok: false, error: validation.error ?? "Invalid email." }, 400);
  if (body.acceptRules !== true) {
    return reply({ ok: false, error: "Please accept the giveaway rules to enter." }, 400);
  }

  const giveaway = await getLiveGiveaway();
  if (!giveaway) return reply({ ok: false, error: "There is no giveaway running right now." }, 404);

  const source: EntrySource = SOURCES.includes(body.source as EntrySource) ? (body.source as EntrySource) : "page";
  const marketingOptIn = body.marketingOptIn === true;
  const email = body.email.trim().toLowerCase();

  try {
    const result = await enterGiveaway({
      giveaway,
      email,
      source,
      marketingOptIn,
      country: eligibility.country,
      locale,
    });

    if (result.ok && result.created) {
      const origin = (process.env.NEXTAUTH_URL || "https://www.al-ai-fx.xyz").replace(/\/+$/, "");
      try {
        await sendGiveawayEntryEmail({
          email,
          title: giveaway.title,
          prize: giveaway.prize,
          endsAt: giveaway.endsAt,
          rulesUrl: `${origin}/giveaway`,
          marketingOptIn,
        });
      } catch (err) {
        console.error("[giveaway] entry email failed (non-fatal):", err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    console.error("[giveaway] entry failed:", err instanceof Error ? err.message : err);
    return reply({ ok: false, error: "We could not save your entry. Please try again." }, 500);
  }

  return reply({ ok: true });
}
