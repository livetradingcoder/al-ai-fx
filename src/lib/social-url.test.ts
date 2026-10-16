import test from "node:test";
import assert from "node:assert/strict";

import { checkSocialUrl } from "./social-url";

test("accepts a post on each supported network and names it", () => {
  const cases: [string, string][] = [
    ["https://x.com/someone/status/123", "X"],
    ["https://twitter.com/someone/status/123", "X"],
    ["https://www.instagram.com/p/abc123/", "Instagram"],
    ["https://m.facebook.com/someone/posts/9", "Facebook"],
    ["https://www.tiktok.com/@someone/video/77", "TikTok"],
    ["https://youtu.be/dQw4w9WgXcQ", "YouTube"],
    ["https://www.linkedin.com/posts/someone-activity-1", "LinkedIn"],
    ["https://www.threads.net/@someone/post/Cx", "Threads"],
  ];
  for (const [input, platform] of cases) {
    const r = checkSocialUrl(input);
    assert.equal(r.ok, true, input);
    if (r.ok) assert.equal(r.platform, platform, input);
  }
});

test("refuses other hosts, look-alikes and wrong schemes", () => {
  for (const bad of [
    "https://evil.example/x.com/status/1",
    "https://x.com.evil.example/status/1",
    "https://notx.com/status/1",
    "http://x.com/someone/status/1",
    "javascript:alert(1)",
    "ftp://x.com/a",
    "https://user:pass@x.com/someone/status/1",
    "not a url",
    "",
  ]) {
    assert.equal(checkSocialUrl(bad).ok, false, bad);
  }
});

test("refuses a bare home page and an overlong link and non-strings", () => {
  assert.equal(checkSocialUrl("https://x.com/").ok, false);
  assert.equal(checkSocialUrl("https://x.com").ok, false);
  assert.equal(checkSocialUrl(`https://x.com/a/${"b".repeat(300)}`).ok, false);
  assert.equal(checkSocialUrl(null).ok, false);
  assert.equal(checkSocialUrl(42).ok, false);
});
