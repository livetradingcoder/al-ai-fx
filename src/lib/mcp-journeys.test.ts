import test from "node:test";
import assert from "node:assert/strict";

import { EXPORT_DEFAULT_LIMIT, EXPORT_MAX_LIMIT, JOURNEY_SERVER, JOURNEY_TOOLS, parseExportArgs } from "./mcp-journeys";
import { ToolInputError } from "./mcp-server";
import { LIST_SEGMENTS, TRIAL_SEGMENTS } from "./segments";

test("export arguments: defaults leave the sign-in links out", () => {
  assert.deepEqual(parseExportArgs({ journey: "linked-no-proof" }), {
    journey: "linked-no-proof",
    includeLinks: false,
    giveaway: null,
    limit: EXPORT_DEFAULT_LIMIT,
    offset: 0,
  });
  assert.equal(parseExportArgs({ journey: "not-linked-active", include_links: true }).includeLinks, true);
  assert.equal(parseExportArgs({ journey: "giveaway-entries", giveaway: "october-2026" }).giveaway, "october-2026");
  assert.equal(parseExportArgs({ journey: "linked-active", limit: 10, offset: 20 }).offset, 20);
});

test("export arguments: refuses unknown journeys and misplaced options", () => {
  const bad = [
    {},
    { journey: "everyone" },
    { journey: 3 },
    { journey: "linked-active", include_links: "yes" },
    { journey: "giveaway-subscribers", include_links: true },
    { journey: "linked-active", giveaway: "october-2026" },
    { journey: "giveaway-entries", giveaway: "bad slug!" },
    { journey: "linked-active", limit: 0 },
    { journey: "linked-active", limit: EXPORT_MAX_LIMIT + 1 },
    { journey: "linked-active", limit: 2.5 },
    { journey: "linked-active", offset: -1 },
  ];
  for (const args of bad) {
    assert.throws(() => parseExportArgs(args), ToolInputError, JSON.stringify(args));
  }
});

test("every journey is offered, and only read-only tools exist", () => {
  const exportTool = JOURNEY_TOOLS.find((t) => t.name === "export_journey");
  assert.ok(exportTool);
  const schema = exportTool.inputSchema as { properties: { journey: { enum: string[] } } };
  assert.deepEqual(schema.properties.journey.enum, [...TRIAL_SEGMENTS, ...LIST_SEGMENTS]);
  assert.deepEqual(
    JOURNEY_TOOLS.map((t) => t.name),
    ["list_journeys", "export_journey", "journey_overview"],
  );
  assert.equal(JOURNEY_SERVER.tools, JOURNEY_TOOLS);
});
