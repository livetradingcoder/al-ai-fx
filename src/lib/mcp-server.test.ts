import test from "node:test";
import assert from "node:assert/strict";

import {
  bearerMatches,
  handleMcpBody,
  handleMcpMessage,
  INVALID_PARAMS,
  INVALID_REQUEST,
  METHOD_NOT_FOUND,
  negotiateProtocolVersion,
  SUPPORTED_PROTOCOL_VERSIONS,
  ToolInputError,
  type McpServer,
} from "./mcp-server";

const TOKEN = "a".repeat(40);

function server(overrides: Partial<McpServer> = {}): McpServer {
  return {
    name: "test",
    version: "1.0.0",
    instructions: "Test server",
    tools: [
      {
        name: "echo",
        title: "Echo",
        description: "Returns its arguments",
        inputSchema: { type: "object" },
        run: async (args) => {
          if (args.bad) throw new ToolInputError("bad must not be set");
          if (args.boom) throw new Error("database password in this message");
          return { got: args };
        },
      },
    ],
    ...overrides,
  };
}

const call = (method: string, params?: unknown, id: unknown = 1) => ({ jsonrpc: "2.0", id, method, params });

test("bearer token: exact match only, and never with a short or missing secret", () => {
  assert.equal(bearerMatches(`Bearer ${TOKEN}`, TOKEN), true);
  assert.equal(bearerMatches(`bearer ${TOKEN}`, TOKEN), true);
  assert.equal(bearerMatches(`Bearer ${TOKEN}x`, TOKEN), false);
  assert.equal(bearerMatches(`Bearer ${TOKEN.slice(1)}`, TOKEN), false);
  assert.equal(bearerMatches(TOKEN, TOKEN), false);
  assert.equal(bearerMatches(`Basic ${TOKEN}`, TOKEN), false);
  assert.equal(bearerMatches(null, TOKEN), false);
  assert.equal(bearerMatches("Bearer short", "short"), false);
  assert.equal(bearerMatches(`Bearer ${TOKEN}`, undefined), false);
  assert.equal(bearerMatches("Bearer ", ""), false);
});

test("protocol version: echo a known one, otherwise offer our newest", () => {
  assert.equal(negotiateProtocolVersion("2025-06-18"), "2025-06-18");
  assert.equal(negotiateProtocolVersion("2024-11-05"), "2024-11-05");
  assert.equal(negotiateProtocolVersion("2099-01-01"), SUPPORTED_PROTOCOL_VERSIONS[0]);
  assert.equal(negotiateProtocolVersion(undefined), SUPPORTED_PROTOCOL_VERSIONS[0]);
});

test("initialize describes the server and offers tools only", async () => {
  const reply = await handleMcpMessage(call("initialize", { protocolVersion: "2025-06-18", capabilities: {} }), server());
  assert.ok(reply && "result" in reply);
  const result = reply.result as Record<string, unknown>;
  assert.equal(result.protocolVersion, "2025-06-18");
  assert.deepEqual(result.capabilities, { tools: { listChanged: false } });
  assert.deepEqual(result.serverInfo, { name: "test", version: "1.0.0" });
  assert.equal(result.instructions, "Test server");
});

test("notifications and client replies get no answer", async () => {
  assert.equal(await handleMcpMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, server()), null);
  assert.equal(await handleMcpMessage({ jsonrpc: "2.0", id: 5, result: {} }, server()), null);
});

test("ping, tools/list and unknown methods", async () => {
  assert.deepEqual(await handleMcpMessage(call("ping", undefined, "p"), server()), { jsonrpc: "2.0", id: "p", result: {} });

  const list = await handleMcpMessage(call("tools/list"), server());
  assert.ok(list && "result" in list);
  const tools = (list.result as { tools: Record<string, unknown>[] }).tools;
  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, "echo");
  assert.equal((tools[0].annotations as Record<string, unknown>).readOnlyHint, true);
  assert.equal("run" in tools[0], false);

  const unknown = await handleMcpMessage(call("resources/list"), server());
  assert.ok(unknown && "error" in unknown);
  assert.equal(unknown.error.code, METHOD_NOT_FOUND);
});

test("malformed messages are invalid requests", async () => {
  for (const bad of [null, "x", 42, { id: 1, method: "ping" }, { jsonrpc: "1.0", id: 1, method: "ping" }, { jsonrpc: "2.0", id: 1 }]) {
    const reply = await handleMcpMessage(bad, server());
    assert.ok(reply && "error" in reply, JSON.stringify(bad));
    assert.equal(reply.error.code, INVALID_REQUEST);
  }
  const objectId = await handleMcpMessage({ jsonrpc: "2.0", id: { x: 1 }, method: "ping" }, server());
  assert.ok(objectId && "error" in objectId);
  assert.equal(objectId.id, null);
});

test("tools/call runs the tool and returns its result as JSON text", async () => {
  const reply = await handleMcpMessage(call("tools/call", { name: "echo", arguments: { a: 1 } }), server());
  assert.ok(reply && "result" in reply);
  const result = reply.result as { content: { type: string; text: string }[]; isError?: boolean };
  assert.equal(result.isError, undefined);
  assert.deepEqual(JSON.parse(result.content[0].text), { got: { a: 1 } });

  const noArgs = await handleMcpMessage(call("tools/call", { name: "echo" }), server());
  assert.ok(noArgs && "result" in noArgs);
});

test("tools/call: unknown tool and non-object arguments are protocol errors", async () => {
  const unknown = await handleMcpMessage(call("tools/call", { name: "nope" }), server());
  assert.ok(unknown && "error" in unknown);
  assert.equal(unknown.error.code, INVALID_PARAMS);

  const badArgs = await handleMcpMessage(call("tools/call", { name: "echo", arguments: [1] }), server());
  assert.ok(badArgs && "error" in badArgs);
  assert.equal(badArgs.error.code, INVALID_PARAMS);
});

test("tools/call: input mistakes are shown, server failures are not leaked", async () => {
  const outcomes: string[] = [];
  const s = server({ onToolCall: (_name, _args, outcome) => outcomes.push(outcome) });

  const input = await handleMcpMessage(call("tools/call", { name: "echo", arguments: { bad: true } }), s);
  assert.ok(input && "result" in input);
  const inputResult = input.result as { content: { text: string }[]; isError: boolean };
  assert.equal(inputResult.isError, true);
  assert.equal(inputResult.content[0].text, "bad must not be set");

  const original = console.error;
  console.error = () => {};
  try {
    const failed = await handleMcpMessage(call("tools/call", { name: "echo", arguments: { boom: true } }), s);
    assert.ok(failed && "result" in failed);
    const failedResult = failed.result as { content: { text: string }[]; isError: boolean };
    assert.equal(failedResult.isError, true);
    assert.doesNotMatch(failedResult.content[0].text, /password/);
  } finally {
    console.error = original;
  }

  await handleMcpMessage(call("tools/call", { name: "echo", arguments: {} }), s);
  assert.deepEqual(outcomes, ["input-error", "failed", "ok"]);
});

test("batches: answers each request, skips notifications, null when nothing to say", async () => {
  const replies = await handleMcpBody(
    [call("ping", undefined, 1), { jsonrpc: "2.0", method: "notifications/initialized" }, call("ping", undefined, 2)],
    server(),
  );
  assert.ok(Array.isArray(replies));
  assert.deepEqual(
    replies.map((r) => r.id),
    [1, 2],
  );

  assert.equal(await handleMcpBody([{ jsonrpc: "2.0", method: "notifications/initialized" }], server()), null);

  const empty = await handleMcpBody([], server());
  assert.ok(empty && !Array.isArray(empty) && "error" in empty);
});
