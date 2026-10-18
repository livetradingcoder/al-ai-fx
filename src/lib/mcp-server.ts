import { createHash, timingSafeEqual } from "node:crypto";

// A small Model Context Protocol server: JSON-RPC 2.0 over plain HTTP POST
// ("Streamable HTTP" without sessions or streaming). It only offers tools, and
// every answer is one JSON response, which is all a read-only reporting server
// needs. No SDK: the surface is four methods and is covered by tests.

export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"] as const;

/** Shorter tokens are treated as "not configured", so a weak value cannot switch the endpoint on. */
export const MCP_MIN_TOKEN_LENGTH = 32;

export type JsonObject = Record<string, unknown>;

export type McpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonObject;
  /** The JSON-able result shown to the model. Throw ToolInputError for bad arguments. */
  run: (args: JsonObject) => Promise<unknown>;
};

export type McpServer = {
  name: string;
  version: string;
  instructions: string;
  tools: McpTool[];
  /** Called once per tool call, for an audit line in the logs. Never given the result. */
  onToolCall?: (name: string, args: JsonObject, outcome: "ok" | "input-error" | "failed") => void;
};

/** A mistake in the arguments: shown to the model so it can correct the call. */
export class ToolInputError extends Error {}

type JsonRpcId = string | number | null;

export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | { jsonrpc: "2.0"; id: JsonRpcId; error: { code: number; message: string } };

export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;

export function rpcError(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validId(value: unknown): value is string | number {
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value));
}

/** The version to answer with: the client's own when we speak it, otherwise our newest. */
export function negotiateProtocolVersion(requested: unknown): string {
  return typeof requested === "string" && (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    ? requested
    : SUPPORTED_PROTOCOL_VERSIONS[0];
}

/**
 * Does the Authorization header carry the expected bearer token? Both sides are
 * hashed first so the comparison takes the same time whatever the input.
 */
export function bearerMatches(header: string | null, expected: string | undefined): boolean {
  if (!expected || expected.length < MCP_MIN_TOKEN_LENGTH) return false;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  if (!match) return false;
  const given = createHash("sha256").update(match[1]).digest();
  const wanted = createHash("sha256").update(expected).digest();
  return timingSafeEqual(given, wanted);
}

/**
 * Answers one JSON-RPC message. Returns null for anything that takes no reply:
 * notifications (no id) and responses the client sends back to us.
 */
export async function handleMcpMessage(message: unknown, server: McpServer): Promise<JsonRpcResponse | null> {
  if (!isObject(message) || message.jsonrpc !== "2.0") {
    return rpcError(isObject(message) && validId(message.id) ? message.id : null, INVALID_REQUEST, "Invalid request");
  }
  if (typeof message.method !== "string") {
    // A reply to a request of ours. We never send any, so there is nothing to do.
    if ("result" in message || "error" in message) return null;
    return rpcError(validId(message.id) ? message.id : null, INVALID_REQUEST, "Invalid request");
  }
  if (!("id" in message)) return null; // notification, e.g. notifications/initialized
  if (!validId(message.id)) return rpcError(null, INVALID_REQUEST, "Invalid request id");

  const id = message.id;
  const params = isObject(message.params) ? message.params : {};

  switch (message.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: negotiateProtocolVersion(params.protocolVersion),
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: server.name, version: server.version },
          instructions: server.instructions,
        },
      };

    case "ping":
      return { jsonrpc: "2.0", id, result: {} };

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: server.tools.map((t) => ({
            name: t.name,
            title: t.title,
            description: t.description,
            inputSchema: t.inputSchema,
            annotations: { title: t.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          })),
        },
      };

    case "tools/call": {
      const tool = server.tools.find((t) => t.name === params.name);
      if (!tool) return rpcError(id, INVALID_PARAMS, `Unknown tool: ${String(params.name)}`);
      const args = params.arguments === undefined ? {} : params.arguments;
      if (!isObject(args)) return rpcError(id, INVALID_PARAMS, "Tool arguments must be an object");

      try {
        const data = await tool.run(args);
        server.onToolCall?.(tool.name, args, "ok");
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(data) }] } };
      } catch (err) {
        const inputError = err instanceof ToolInputError;
        server.onToolCall?.(tool.name, args, inputError ? "input-error" : "failed");
        if (!inputError) console.error(`[mcp] ${tool.name} failed:`, err instanceof Error ? err.message : err);
        const text = inputError ? err.message : "The tool failed on the server. Try again, or check the server logs.";
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text }], isError: true } };
      }
    }

    default:
      return rpcError(id, METHOD_NOT_FOUND, `Method not found: ${message.method}`);
  }
}

/**
 * Answers a parsed POST body: one message, or a batch (allowed by older
 * protocol versions). Null when nothing needs a reply (HTTP 202).
 */
export async function handleMcpBody(body: unknown, server: McpServer): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
  if (Array.isArray(body)) {
    if (body.length === 0) return rpcError(null, INVALID_REQUEST, "Empty batch");
    const replies: JsonRpcResponse[] = [];
    for (const message of body) {
      const reply = await handleMcpMessage(message, server);
      if (reply) replies.push(reply);
    }
    return replies.length > 0 ? replies : null;
  }
  return handleMcpMessage(body, server);
}
