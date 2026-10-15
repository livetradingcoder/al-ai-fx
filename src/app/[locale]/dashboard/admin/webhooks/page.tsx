import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import WebhooksAdmin, { type DeliveryRow, type WebhookRow } from "./WebhooksAdmin";

export const metadata = { title: "Webhooks" };

const DAY_MS = 24 * 60 * 60 * 1000;

async function load() {
  const since = new Date(Date.now() - DAY_MS);
  const [endpoints, recent, counts] = await Promise.all([
    prisma.outboundWebhook.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.outboundWebhookDelivery.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { webhook: { select: { name: true } } },
    }),
    prisma.outboundWebhookDelivery.groupBy({
      by: ["webhookId", "status"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);
  return { endpoints, recent, counts };
}

export default async function AdminWebhooksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/dashboard");

  let data: Awaited<ReturnType<typeof load>> | null = null;
  let missingTables = false;
  try {
    data = await load();
  } catch (err) {
    // The migration has not been applied yet: say so instead of a 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") missingTables = true;
    else throw err;
  }

  const count = (webhookId: string, status: string) =>
    data?.counts.find((c) => c.webhookId === webhookId && c.status === status)?._count._all ?? 0;

  const webhooks: WebhookRow[] = (data?.endpoints ?? []).map((w) => ({
    id: w.id,
    name: w.name,
    url: w.url,
    secretHint: w.secret.slice(-4),
    events: w.events,
    enabled: w.enabled,
    signatureFormat: w.signatureFormat,
    delivered24h: count(w.id, "DELIVERED"),
    failed24h: count(w.id, "FAILED"),
  }));

  const deliveries: DeliveryRow[] = (data?.recent ?? []).map((d) => ({
    id: d.id,
    webhookName: d.webhook.name,
    event: d.event,
    status: d.status,
    attempts: d.attempts,
    httpStatus: d.httpStatus,
    durationMs: d.durationMs,
    error: d.error,
    responseBody: d.responseBody,
    payload: JSON.stringify(d.payload, null, 2),
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <>
      <header style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "2.1rem", marginBottom: "0.35rem" }}>Webhooks</h1>
        <p style={{ color: "var(--text-secondary)", maxWidth: "72ch" }}>
          Every new signup, free trial and sale is posted to the URLs below, signed with each
          endpoint&apos;s secret (HMAC-SHA256 of the body, in <code>X-Webhook-Signature</code>). Point
          one at a relay to get the event as a WhatsApp message. A failed delivery is retried twice,
          then stays in the log until you send it again.
        </p>
      </header>

      {missingTables && (
        <p className="admin-notice is-error" role="alert">
          The webhook tables do not exist yet. Run <code>npx prisma migrate deploy</code> on the
          server, then reload this page.
        </p>
      )}

      <WebhooksAdmin webhooks={webhooks} deliveries={deliveries} disabled={missingTables} />
    </>
  );
}
