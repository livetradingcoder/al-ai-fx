// The link to a social post that shows someone's results. It is shown to an
// admin who opens it, so it has to be a plain https link to a known network:
// no other schemes, no credentials in the URL, no look-alike hosts.

const PLATFORMS: { platform: string; hosts: string[] }[] = [
  { platform: "X", hosts: ["x.com", "twitter.com"] },
  { platform: "Instagram", hosts: ["instagram.com"] },
  { platform: "Facebook", hosts: ["facebook.com", "fb.com", "fb.watch"] },
  { platform: "TikTok", hosts: ["tiktok.com"] },
  { platform: "YouTube", hosts: ["youtube.com", "youtu.be"] },
  { platform: "LinkedIn", hosts: ["linkedin.com"] },
  { platform: "Threads", hosts: ["threads.net", "threads.com"] },
];

const MAX_LENGTH = 300;

export type SocialUrlCheck = { ok: true; url: string; platform: string } | { ok: false; error: string };

export function checkSocialUrl(raw: unknown): SocialUrlCheck {
  if (typeof raw !== "string") return { ok: false, error: "Paste the link to your post." };
  const text = raw.trim();
  if (!text) return { ok: false, error: "Paste the link to your post." };
  if (text.length > MAX_LENGTH) return { ok: false, error: "That link is too long." };

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, error: "That does not look like a link." };
  }

  if (url.protocol !== "https:") return { ok: false, error: "The link must start with https://." };
  if (url.username || url.password) return { ok: false, error: "That link is not allowed." };

  const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  const found = PLATFORMS.find((p) => p.hosts.some((h) => host === h || host.endsWith(`.${h}`)));
  if (!found) {
    return {
      ok: false,
      error: "Use a link to a post on X, Instagram, Facebook, TikTok, YouTube, LinkedIn or Threads.",
    };
  }

  // A bare profile or home page is not a post.
  if (url.pathname.replace(/\/+$/, "") === "") {
    return { ok: false, error: "Link to the post itself, not the home page." };
  }

  return { ok: true, url: url.toString(), platform: found.platform };
}
