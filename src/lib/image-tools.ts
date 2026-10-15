// sharp ships with Next.js (it does the image optimisation) and turns a PNG
// into a much smaller JPEG. It is loaded on first use and its absence is
// survivable: callers fall back to the original bytes.

type Sharp = typeof import("sharp");

let loaded: Sharp | null | undefined;

export async function getSharp(): Promise<Sharp | null> {
  if (loaded !== undefined) return loaded;
  try {
    const mod = await import("sharp");
    loaded = (mod.default ?? mod) as Sharp;
  } catch (err) {
    console.error("[images] sharp is unavailable, serving images unconverted:", err instanceof Error ? err.message : err);
    loaded = null;
  }
  return loaded;
}
