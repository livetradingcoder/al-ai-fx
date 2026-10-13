import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  buildServerEvent,
  buildUserData,
  cleanClientIp,
  fbcFromUrl,
  getRecentMetaSends,
  isValidFbc,
  metaConfig,
  normalizeZip,
  parseCookies,
  sendMetaEvents,
  sha256Hex,
} from "./meta-capi";
import { META_RELAYED_EVENTS, metaEventId } from "./meta-shared";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const FBP = "fb.1.1760000000000.1234567890";
const FBC = "fb.1.1760000000000.IwAR0AbCdEfGhIjKlMn_oPqRsTuV-wXyZ";
const UA = "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/141.0 Safari/537.36";

function withEnv(overrides: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key];
    if (overrides[key] === undefined) delete process.env[key];
    else process.env[key] = overrides[key];
  }
  const restore = () => {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  };
  try {
    const out = fn();
    if (out instanceof Promise) return out.finally(restore);
    restore();
    return out;
  } catch (err) {
    restore();
    throw err;
  }
}

// --- hashing and normalisation -------------------------------------------------

test("sha256Hex matches the well-known digest for test@example.com", () => {
  assert.equal(sha256Hex("test@example.com"), "973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b");
});

test("an email is trimmed and lowercased before hashing", () => {
  const a = buildUserData({ email: "  John_Smith@Gmail.COM " });
  assert.deepEqual(a.em, [sha("john_smith@gmail.com")]);
});

test("names, city, state, zip and country follow Meta's rules", () => {
  const data = buildUserData({
    firstName: "Mary-Jane",
    lastName: "O'Neil ",
    city: "New York",
    state: "CA",
    zip: "94043-1234",
    country: "US",
  });
  assert.deepEqual(data.fn, [sha("maryjane")]);
  assert.deepEqual(data.ln, [sha("oneil")]);
  assert.deepEqual(data.ct, [sha("newyork")]);
  assert.deepEqual(data.st, [sha("ca")]);
  assert.deepEqual(data.zp, [sha("94043")]);
  assert.deepEqual(data.country, [sha("us")]);
  assert.equal(normalizeZip("M1 1AE"), "m11ae");
});

test("a country that is not two letters is dropped rather than hashed wrongly", () => {
  assert.equal(buildUserData({ country: "United States" }).country, undefined);
});

test("external_id is hashed too", () => {
  assert.deepEqual(buildUserData({ externalId: "user_123" }).external_id, [sha("user_123")]);
});

test("IP, user agent, fbp and fbc go out exactly as given, never hashed", () => {
  const data = buildUserData({ ip: "8.8.8.8", userAgent: UA, fbp: FBP, fbc: FBC });
  assert.equal(data.client_ip_address, "8.8.8.8");
  assert.equal(data.client_user_agent, UA);
  assert.equal(data.fbp, FBP);
  assert.equal(data.fbc, FBC, "fbc is case-sensitive and must not be lowercased");
});

test("a malformed fbp or fbc is dropped instead of sent", () => {
  const data = buildUserData({ fbp: "not-a-cookie", fbc: "fb.1.12.x" });
  assert.equal(data.fbp, undefined);
  assert.equal(data.fbc, undefined);
  assert.equal(isValidFbc(FBC), true);
});

test("empty values never become a hash of the empty string", () => {
  assert.deepEqual(buildUserData({ email: "   ", firstName: "", city: "!!" }), {});
});

// --- request-derived values ---------------------------------------------------

test("cleanClientIp keeps public addresses and drops private or invalid ones", () => {
  assert.equal(cleanClientIp("8.8.8.8, 10.0.0.1"), "8.8.8.8");
  assert.equal(cleanClientIp("::ffff:8.8.4.4"), "8.8.4.4");
  assert.equal(cleanClientIp("2a00:1450:4001:81b::200e"), "2a00:1450:4001:81b::200e");
  assert.equal(cleanClientIp("10.1.2.3"), undefined);
  assert.equal(cleanClientIp("192.168.1.9"), undefined);
  assert.equal(cleanClientIp("127.0.0.1"), undefined);
  assert.equal(cleanClientIp("172.20.0.5"), undefined);
  assert.equal(cleanClientIp("::1"), undefined);
  assert.equal(cleanClientIp("fd00::1"), undefined);
  assert.equal(cleanClientIp("not an ip"), undefined);
  assert.equal(cleanClientIp(null), undefined);
});

test("parseCookies keeps values intact, including = and case", () => {
  const cookies = parseCookies(`a=1; _fbc=${FBC}; token=abc=def==; bad; =x`);
  assert.equal(cookies.a, "1");
  assert.equal(cookies._fbc, FBC);
  assert.equal(cookies.token, "abc=def==");
  assert.equal(cookies.bad, undefined);
});

test("fbcFromUrl builds the cookie value from an fbclid, and only from a sane one", () => {
  assert.equal(
    fbcFromUrl("https://www.al-ai-fx.xyz/?utm_source=fb&fbclid=IwAR0AbCdEfGhIjKl", 1760000000123),
    "fb.1.1760000000123.IwAR0AbCdEfGhIjKl",
  );
  assert.equal(fbcFromUrl("https://www.al-ai-fx.xyz/?fbclid=short", 1), undefined);
  assert.equal(fbcFromUrl("https://www.al-ai-fx.xyz/", 1), undefined);
  assert.equal(fbcFromUrl("::not a url::", 1), undefined);
  assert.equal(fbcFromUrl(undefined, 1), undefined);
});

// --- events -------------------------------------------------------------------

const baseUser = { email: "buyer@example.com", ip: "8.8.8.8", userAgent: UA, fbp: FBP, fbc: FBC };
const SOURCE = "https://www.al-ai-fx.xyz/checkout?tier=1-month&robot=goldbot";

test("a website event carries everything Meta asks for", () => {
  const event = buildServerEvent({
    name: "Purchase",
    eventId: "POLAR-abc",
    sourceUrl: SOURCE,
    user: baseUser,
    custom: { value: 99, currency: "USD", content_ids: ["goldbot"], content_type: "product" },
    timeSec: 1760000000,
  });
  assert.ok(event);
  assert.equal(event.event_name, "Purchase");
  assert.equal(event.event_id, "POLAR-abc");
  assert.equal(event.event_time, 1760000000);
  assert.equal(event.action_source, "website");
  assert.equal(event.event_source_url, SOURCE);
  assert.deepEqual(event.user_data.em, [sha("buyer@example.com")]);
  assert.equal(event.custom_data?.value, 99);
});

test("an event Meta would reject is not built at all", () => {
  const ok = { name: "ViewContent" as const, eventId: "e1", sourceUrl: SOURCE, user: baseUser };
  assert.ok(buildServerEvent(ok));
  // no user agent: required for website events
  assert.equal(buildServerEvent({ ...ok, user: { ...baseUser, userAgent: undefined } }), null);
  // no page URL: required for website events
  assert.equal(buildServerEvent({ ...ok, sourceUrl: undefined }), null);
  // a user agent and nothing else is not enough to match anyone
  assert.equal(buildServerEvent({ ...ok, user: { userAgent: UA } }), null);
  // a Purchase needs a positive value and a currency
  assert.equal(buildServerEvent({ ...ok, name: "Purchase" }), null);
  assert.equal(buildServerEvent({ ...ok, name: "Purchase", custom: { value: 0, currency: "USD" } }), null);
  assert.equal(buildServerEvent({ ...ok, name: "Purchase", custom: { value: 5 } }), null);
});

test("event ids are derived, so the browser and server agree without talking", () => {
  assert.equal(metaEventId("Purchase", "POLAR-abc"), "POLAR-abc");
  assert.equal(metaEventId("AddPaymentInfo", "POLAR-abc"), "pay:POLAR-abc");
  assert.equal(metaEventId("StartTrial", "sub1"), "trial:sub1");
  assert.equal(metaEventId("CompleteRegistration", "user1"), "reg:user1");
});

test("only browsing events can be relayed from the browser, never a payment or signup", () => {
  assert.deepEqual([...META_RELAYED_EVENTS], ["ViewContent", "AddToCart", "InitiateCheckout"]);
});

// --- config and sending -------------------------------------------------------

test("config falls back to the public pixel and the default API version", () => {
  withEnv(
    {
      META_CAPI_ACCESS_TOKEN: undefined,
      NEXT_PUBLIC_META_PIXEL_ID: undefined,
      META_GRAPH_API_VERSION: undefined,
      META_CAPI_TEST_EVENT_CODE: undefined,
    },
    () => {
      const config = metaConfig();
      assert.equal(config.token, null);
      assert.equal(config.pixelId, "1100062386089751");
      assert.equal(config.version, "v26.0");
      assert.equal(config.testEventCode, null);
      assert.equal(config.baseUrl, "https://graph.facebook.com");
    },
  );
});

test("the Graph URL can be redirected for tests, but never in production", () => {
  withEnv({ NODE_ENV: "development", META_GRAPH_BASE_URL: "http://127.0.0.1:9999/" }, () => {
    assert.equal(metaConfig().baseUrl, "http://127.0.0.1:9999");
  });
  withEnv({ NODE_ENV: "production", META_GRAPH_BASE_URL: "http://127.0.0.1:9999" }, () => {
    assert.equal(metaConfig().baseUrl, "https://graph.facebook.com");
  });
});

type FetchCall = { url: string; body: Record<string, unknown> };

async function withFetch(
  responses: Array<{ status: number; json?: unknown } | Error>,
  fn: (calls: FetchCall[]) => Promise<void>,
) {
  const original = globalThis.fetch;
  const calls: FetchCall[] = [];
  let i = 0;
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
    const next = responses[Math.min(i++, responses.length - 1)];
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next.json ?? {}), { status: next.status });
  }) as typeof fetch;
  try {
    await fn(calls);
  } finally {
    globalThis.fetch = original;
  }
}

const sampleEvent = buildServerEvent({
  name: "ViewContent",
  eventId: "e-1",
  sourceUrl: SOURCE,
  user: baseUser,
})!;

test("sending posts the events and the token in the body, to the pixel's /events edge", async () => {
  await withEnv(
    { META_CAPI_ACCESS_TOKEN: "TOKEN-123", META_CAPI_TEST_EVENT_CODE: undefined, NODE_ENV: "production" },
    () =>
      withFetch([{ status: 200, json: { events_received: 1, fbtrace_id: "trace-1" } }], async (calls) => {
        const result = await sendMetaEvents([sampleEvent]);
        assert.equal(result.ok, true);
        assert.equal(result.eventsReceived, 1);
        assert.equal(result.fbtraceId, "trace-1");
        assert.equal(calls.length, 1);
        assert.equal(calls[0].url, "https://graph.facebook.com/v26.0/1100062386089751/events");
        assert.equal(calls[0].body.access_token, "TOKEN-123");
        assert.equal((calls[0].body.data as unknown[]).length, 1);
        assert.equal(calls[0].body.test_event_code, undefined);
      }),
  );
});

test("a test event code is passed through and the send is marked as a test", async () => {
  await withEnv({ META_CAPI_ACCESS_TOKEN: "TOKEN-123", NODE_ENV: "production" }, () =>
    withFetch([{ status: 200, json: { events_received: 1 } }], async (calls) => {
      const result = await sendMetaEvents([sampleEvent], { testEventCode: "TEST123" });
      assert.equal(calls[0].body.test_event_code, "TEST123");
      assert.equal(result.test, true);
    }),
  );
});

test("without a token nothing is sent and the result says why", async () => {
  await withEnv({ META_CAPI_ACCESS_TOKEN: undefined }, () =>
    withFetch([{ status: 200 }], async (calls) => {
      const result = await sendMetaEvents([sampleEvent]);
      assert.equal(result.ok, false);
      assert.equal(result.skipped, true);
      assert.match(result.error ?? "", /META_CAPI_ACCESS_TOKEN/);
      assert.equal(calls.length, 0);
    }),
  );
});

test("a 4xx is reported once and not retried; Meta's message comes through", async () => {
  await withEnv({ META_CAPI_ACCESS_TOKEN: "TOKEN-123", NODE_ENV: "production" }, () =>
    withFetch(
      [{ status: 400, json: { error: { message: "Invalid OAuth access token.", code: 190, fbtrace_id: "t9" } } }],
      async (calls) => {
        const result = await sendMetaEvents([sampleEvent]);
        assert.equal(result.ok, false);
        assert.equal(result.status, 400);
        assert.equal(result.error, "Invalid OAuth access token.");
        assert.equal(result.fbtraceId, "t9");
        assert.equal(calls.length, 1);
      },
    ),
  );
});

test("a server error is retried once and can then succeed", async () => {
  await withEnv({ META_CAPI_ACCESS_TOKEN: "TOKEN-123", NODE_ENV: "production" }, () =>
    withFetch([{ status: 503 }, { status: 200, json: { events_received: 1 } }], async (calls) => {
      const result = await sendMetaEvents([sampleEvent]);
      assert.equal(result.ok, true);
      assert.equal(calls.length, 2);
    }),
  );
});

test("a network failure never throws to the caller", async () => {
  await withEnv({ META_CAPI_ACCESS_TOKEN: "TOKEN-123", NODE_ENV: "production" }, () =>
    withFetch([new Error("socket hang up")], async () => {
      const result = await sendMetaEvents([sampleEvent]);
      assert.equal(result.ok, false);
      assert.match(result.error ?? "", /socket hang up/);
    }),
  );
});

test("the recent-sends log never holds the token or any personal data", async () => {
  await withEnv({ META_CAPI_ACCESS_TOKEN: "TOKEN-SECRET-XYZ", NODE_ENV: "production" }, () =>
    withFetch([{ status: 200, json: { events_received: 1 } }], async () => {
      await sendMetaEvents([sampleEvent]);
      const dump = JSON.stringify(getRecentMetaSends());
      assert.ok(getRecentMetaSends().length > 0);
      assert.equal(dump.includes("TOKEN-SECRET-XYZ"), false);
      assert.equal(dump.includes("buyer@example.com"), false);
      assert.equal(dump.includes("8.8.8.8"), false);
    }),
  );
});
