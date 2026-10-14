import test from "node:test";
import assert from "node:assert/strict";

// marketing-client talks to window, localStorage and fetch. Give it small
// stand-ins, then import it, so the logic that decides what goes to Meta (and
// under which ID) can be checked without a browser.

type FbqCall = unknown[];
const fbqCalls: FbqCall[] = [];
const fetchCalls: { url: string; body: Record<string, unknown> }[] = [];
const local = new Map<string, string>();
const session = new Map<string, string>();

const storage = (m: Map<string, string>) => ({
  getItem: (k: string) => m.get(k) ?? null,
  setItem: (k: string, v: string) => void m.set(k, v),
  removeItem: (k: string) => void m.delete(k),
});

const fakeWindow: Record<string, unknown> = {
  localStorage: storage(local),
  sessionStorage: storage(session),
  location: {
    href: "https://www.al-ai-fx.xyz/checkout?tier=1-month&robot=goldbot",
    search: "",
    hostname: "www.al-ai-fx.xyz",
    protocol: "https:",
  },
  setTimeout: globalThis.setTimeout.bind(globalThis),
  dataLayer: [],
  __metaPixelId: "1100062386089751",
};
const fakeDocument = { cookie: "" };

Object.assign(globalThis, { window: fakeWindow, document: fakeDocument, location: fakeWindow.location });
// A European visitor unless a test says otherwise: with no stored choice, they
// have not consented. (Outside Europe the default is on; tested below.)
process.env.TZ = "Europe/Berlin";
globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
  fetchCalls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
  return new Response(null, { status: 204 });
}) as typeof fetch;

function reset({ consent }: { consent: boolean }) {
  fbqCalls.length = 0;
  fetchCalls.length = 0;
  local.clear();
  session.clear();
  fakeDocument.cookie = "";
  fakeWindow.fbq = (...args: unknown[]) => void fbqCalls.push(args);
  if (consent) local.set("al_consent_v1", "granted");
}

const lib = await import("./marketing-client");

const item = { amount: 99, currency: "USD", robotSlug: "goldbot", robotName: "GoldBot", tierSlug: "1-month" };

test("AddToCart goes to our pixel only, and the same event ID reaches the server copy", () => {
  reset({ consent: true });
  lib.trackAddToCart(item);

  assert.equal(fbqCalls.length, 1);
  const [method, pixelId, name, data, options] = fbqCalls[0] as [string, string, string, Record<string, unknown>, { eventID: string }];
  assert.equal(method, "trackSingle", "never a plain track: that would also feed the GTM container's pixel");
  assert.equal(pixelId, "1100062386089751");
  assert.equal(name, "AddToCart");
  assert.equal(data.value, 99);
  assert.equal(data.currency, "USD");
  assert.deepEqual(data.content_ids, ["goldbot"]);
  assert.equal(data.content_type, "product");

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, "/api/meta/event");
  assert.equal(fetchCalls[0].body.event, "AddToCart");
  assert.equal(fetchCalls[0].body.eventId, options.eventID, "pixel and server must share one event ID");
  assert.equal(fetchCalls[0].body.url, "https://www.al-ai-fx.xyz/checkout?tier=1-month&robot=goldbot");
});

test("nothing is relayed to our server without consent; the pixel call is still made (the pixel holds it itself)", () => {
  reset({ consent: false });
  lib.trackInitiateCheckout(item);
  assert.equal(fbqCalls.length, 1);
  assert.equal(fetchCalls.length, 0);

  local.set("al_consent_v1", "denied");
  lib.trackViewContent(item);
  assert.equal(fetchCalls.length, 0);
});

test("outside Europe a visitor who made no choice is tracked, until they reject", () => {
  process.env.TZ = "Asia/Karachi";
  try {
    reset({ consent: false });
    lib.trackInitiateCheckout(item);
    assert.equal(fetchCalls.length, 1);

    lib.syncConsentCookie();
    assert.match(fakeDocument.cookie, /^al_consent=granted;/);

    local.set("al_consent_v1", "denied");
    lib.trackViewContent(item);
    assert.equal(fetchCalls.length, 1);
  } finally {
    process.env.TZ = "Europe/Berlin";
  }
});

test("AddPaymentInfo uses the derived ID the server used, and is never relayed", () => {
  reset({ consent: true });
  lib.trackBeginCheckout({
    amount: 99,
    currency: "USD",
    orderRef: "POLAR-abc",
    tier: "1-month",
    tierSlug: "1-month",
    robotSlug: "goldbot",
    robotName: "GoldBot",
  });

  const call = fbqCalls.find((c) => c[2] === "AddPaymentInfo") as unknown[];
  assert.ok(call);
  assert.deepEqual(call[4], { eventID: "pay:POLAR-abc" });
  assert.equal(fetchCalls.length, 0, "the server sends this one itself, as it creates the session");
});

test("Purchase: event ID is the order reference, order_id is set, and it fires once", () => {
  reset({ consent: true });
  const purchase = {
    amount: 99,
    currency: "USD",
    orderRef: "POLAR-abc",
    tier: "Monthly Plan",
    tierSlug: "1-month",
    robotSlug: "goldbot",
    robotName: "GoldBot",
  };
  lib.trackPurchase(purchase);
  lib.trackPurchase(purchase);

  const calls = fbqCalls.filter((c) => c[2] === "Purchase");
  assert.equal(calls.length, 1, "a reload of the thank-you page must not count the sale twice");
  assert.deepEqual(calls[0][4], { eventID: "POLAR-abc" });
  assert.equal((calls[0][3] as Record<string, unknown>).order_id, "POLAR-abc");
  assert.equal((calls[0][3] as Record<string, unknown>).content_category, "1-month");
  assert.equal(fetchCalls.length, 0, "a purchase can never be relayed through the browser");
});

test("a $0 order is not reported to Meta as a purchase", () => {
  reset({ consent: true });
  lib.trackPurchase({ amount: 0, currency: "USD", orderRef: "POLAR-free", tier: "Monthly Plan", tierSlug: "1-month" });
  assert.equal(fbqCalls.filter((c) => c[2] === "Purchase").length, 0);
});

test("a trial and its registration use IDs derived from the ids the server returned", () => {
  reset({ consent: true });
  lib.trackStartTrial({ subscriptionId: "sub1", robotSlug: "goldbot", robotName: "GoldBot" });
  lib.trackCompleteRegistration({ userId: "user1", robotName: "GoldBot" });

  const start = fbqCalls.find((c) => c[2] === "StartTrial") as unknown[];
  const reg = fbqCalls.find((c) => c[2] === "CompleteRegistration") as unknown[];
  assert.deepEqual(start[4], { eventID: "trial:sub1" });
  assert.deepEqual(reg[4], { eventID: "reg:user1" });
  assert.equal(fetchCalls.length, 0);
});

test("an event fired before the pixel script has defined fbq is sent once it appears", async () => {
  reset({ consent: false });
  delete fakeWindow.fbq;
  lib.trackViewContent(item);
  assert.equal(fbqCalls.length, 0);

  fakeWindow.fbq = (...args: unknown[]) => void fbqCalls.push(args);
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.equal(fbqCalls.length, 1);
  assert.equal(fbqCalls[0][2], "ViewContent");
});

test("the click ID cookie is built from fbclid, once, and only after consent", () => {
  reset({ consent: false });
  (fakeWindow.location as { search: string }).search = "?fbclid=IwAR0AbCdEfGhIjKlMn";
  lib.ensureFbcCookie();
  assert.equal(fakeDocument.cookie, "", "no consent, no cookie");

  local.set("al_consent_v1", "granted");
  lib.ensureFbcCookie();
  assert.match(fakeDocument.cookie, /^_fbc=fb\.1\.\d{13}\.IwAR0AbCdEfGhIjKlMn; Max-Age=7776000; Path=\/; SameSite=Lax; Domain=\.al-ai-fx\.xyz; Secure$/);

  // an existing cookie is left alone
  fakeDocument.cookie = "_fbc=fb.1.1760000000000.existingvalue123";
  lib.ensureFbcCookie();
  assert.equal(fakeDocument.cookie, "_fbc=fb.1.1760000000000.existingvalue123");
  (fakeWindow.location as { search: string }).search = "";
});

test("the consent choice made earlier is mirrored into the cookie the server reads", () => {
  reset({ consent: true });
  lib.syncConsentCookie();
  assert.match(fakeDocument.cookie, /^al_consent=granted; Max-Age=31536000; Path=\/; SameSite=Lax; Secure$/);
});
