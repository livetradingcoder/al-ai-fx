import { JOURNEY_SERVER } from "@/lib/mcp-journeys";
import { bearerMatches, handleMcpBody, MCP_MIN_TOKEN_LENGTH, PARSE_ERROR, rpcError } from "@/lib/mcp-server";
import { checkMcpRateLimit, getClientIdentifier } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 64 * 1024;

const HEADERS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

/** Off unless MCP_ADMIN_TOKEN is set (32+ characters). Off looks like any missing page. */
function enabled() {
  return (process.env.MCP_ADMIN_TOKEN?.length ?? 0) >= MCP_MIN_TOKEN_LENGTH;
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: HEADERS });
}

/**
 * POST /api/mcp  (Model Context Protocol, JSON-RPC over HTTP)
 *
 * Lets an assistant (Claude Code) read the customer journey lists that the
 * admin Email lists card offers as CSV. Read only. Auth is one admin bearer
 * token from the MCP_ADMIN_TOKEN env var; there is no session or cookie, so the
 * same-origin rule in proxy.ts still stops browsers posting here from elsewhere.
 */
export async function POST(req: Request) {
  if (!enabled()) return new Response("Not found", { status: 404 });

  const { success } = await checkMcpRateLimit(getClientIdentifier(req));
  if (!success) return new Response("Too many requests", { status: 429, headers: { "Retry-After": "60" } });

  if (!bearerMatches(req.headers.get("authorization"), process.env.MCP_ADMIN_TOKEN)) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { ...HEADERS, "WWW-Authenticate": 'Bearer realm="al-ai-fx", error="invalid_token"' },
    });
  }

  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json(rpcError(null, PARSE_ERROR, "Parse error"), 400);
  }

  const reply = await handleMcpBody(body, JOURNEY_SERVER);
  // Notifications only: accepted, nothing to say.
  if (reply === null) return new Response(null, { status: 202, headers: HEADERS });
  return json(reply);
}

/** No server-to-client stream is offered; the protocol says to answer 405. */
export function GET() {
  if (!enabled()) return new Response("Not found", { status: 404 });
  return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
}
