import { buildLlmsTxt } from "@/lib/llms";

// Regenerated hourly from the live catalog (see src/lib/llms.ts).
export const revalidate = 3600;

export async function GET() {
  return new Response(await buildLlmsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
