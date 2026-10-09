import { createPolar } from "@polar-sh/sdk/2026-10";

// Polar checkout + webhooks. Env:
//   POLAR_ACCESS_TOKEN    organization access token (polar_oat_…)
//   POLAR_WEBHOOK_SECRET  signing secret of the /api/webhooks/polar endpoint
//   POLAR_SERVER          production | sandbox (default production)

type PolarClient = ReturnType<typeof createPolar>;
let client: PolarClient | null = null;

// One client, created on first use so builds without the token still pass.
export function polar(): PolarClient {
  if (!client) {
    const accessToken = process.env.POLAR_ACCESS_TOKEN?.trim();
    if (!accessToken) throw new Error("polar not configured");
    client = createPolar({
      accessToken,
      environment: process.env.POLAR_SERVER === "sandbox" ? "sandbox" : "production",
    });
  }
  return client;
}
