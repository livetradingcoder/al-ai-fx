import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Satori (the renderer behind ImageResponse) quietly drops the children of a
// React Fragment, which once made every robot card lose its picture while
// looking fine in development. Keep fragments out of the card file.
test("the share card markup uses no React fragments", () => {
  const source = readFileSync(path.join(process.cwd(), "src/lib/og-card.tsx"), "utf8");
  assert.ok(!/<>|<\/>|Fragment/.test(source), "use two sibling conditionals instead of <>…</>");
});

test("every box in the card file is a flex box, which is all Satori lays out", () => {
  const source = readFileSync(path.join(process.cwd(), "src/lib/og-card.tsx"), "utf8");
  assert.ok(!/display:\s*"grid"|display:\s*"block"/.test(source));
});
