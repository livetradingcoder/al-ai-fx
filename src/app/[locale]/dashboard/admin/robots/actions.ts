"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { uploadEncryptedSource } from "@/lib/source-storage";
import { Prisma, PricingTier } from "@prisma/client";
import { TIER_METADATA } from "@/lib/pricing-tiers";
import type { ActionResult } from "@/lib/action-result";

export async function toggleRobotActive(robotId: string, currentActive: boolean): Promise<ActionResult> {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "Unauthorized" };
  }

  const robot = await prisma.robot.update({
    where: { id: robotId },
    data: { active: !currentActive },
  });

  revalidatePath("/dashboard/admin/robots");
  return {
    ok: true,
    message: currentActive
      ? `${robot.name} is no longer listed on the catalog.`
      : `${robot.name} is listed on the catalog.`,
  };
}

export async function updateRobot(
  robotId: string,
  data: {
    name: string;
    shortDescription: string;
    longDescription: string;
    artworkUrl: string;
    sortOrder: number;
  }
): Promise<ActionResult> {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "Unauthorized" };
  }

  const name = data.name?.trim();
  const shortDescription = data.shortDescription?.trim();
  if (!name || !shortDescription) {
    return { ok: false, error: "Name and short description are required" };
  }

  // NOTE: slug (immutable join key) and sourceVersion (bumped only by upload
  // action in Plan 05-02) are intentionally never written here.
  await prisma.robot.update({
    where: { id: robotId },
    data: {
      name,
      shortDescription,
      longDescription: data.longDescription ?? "",
      // artworkUrl is nullable — store null when blank, never "" masquerading as a URL
      artworkUrl: data.artworkUrl?.trim() ? data.artworkUrl.trim() : null,
      sortOrder: Number.isFinite(data.sortOrder) ? Math.trunc(data.sortOrder) : 0,
    },
  });

  revalidatePath("/dashboard/admin/robots");
  return { ok: true, message: `${name} saved.` };
}

export async function createRobot(formData: FormData): Promise<ActionResult> {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "Unauthorized" };
  }

  const slug = String(formData.get("slug") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const shortDescription = String(formData.get("shortDescription") || "").trim();
  const longDescription = String(formData.get("longDescription") || "").trim();
  const artworkUrlRaw = String(formData.get("artworkUrl") || "").trim();
  const sortOrder = Math.trunc(Number(formData.get("sortOrder") || 0));

  if (!slug || !name || !shortDescription) {
    return { ok: false, error: "Slug, name, and short description are required" };
  }
  // slug shape guard: lowercase kebab (join key for Blob path)
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { ok: false, error: "Slug must be lowercase letters, numbers, and hyphens only" };
  }

  let robot;
  try {
    robot = await prisma.robot.create({
      data: {
        slug,
        name,
        shortDescription,
        longDescription: longDescription || shortDescription,
        artworkUrl: artworkUrlRaw || null,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        active: false, // new robots start inactive until a source is uploaded + reviewed
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: `A robot with slug "${slug}" already exists` };
    }
    throw e;
  }

  // Optional first source → upload to v1, leave sourceVersion=1 (first-source semantics).
  const file = formData.get("source");
  if (file instanceof File && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer());
    await uploadEncryptedSource(robot.slug, 1, buf); // sources/<slug>/v1.mq5.enc
  }

  revalidatePath("/dashboard/admin/robots");
  return { ok: true, message: `${robot.name} created.` };
}

export async function uploadRobotSource(formData: FormData): Promise<ActionResult> {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "Unauthorized" };
  }

  const robotId = String(formData.get("robotId") || "");
  const file = formData.get("source");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "A .mq5 source file is required" };
  }

  const robot = await prisma.robot.findUniqueOrThrow({ where: { id: robotId } });
  const nextVersion = robot.sourceVersion + 1;
  const buf = Buffer.from(await file.arrayBuffer());

  // Upload FIRST (immutable put to a NEW version path) — only bump after it succeeds,
  // so a failed upload never leaves sourceVersion pointing at a missing blob.
  await uploadEncryptedSource(robot.slug, nextVersion, buf);
  await prisma.robot.update({ where: { id: robotId }, data: { sourceVersion: nextVersion } });

  revalidatePath("/dashboard/admin/robots");
  return { ok: true, message: `Source uploaded — now at v${nextVersion}.` };
}

export async function getRobotPrices(robotId: string) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return prisma.robotPrice.findMany({ where: { robotId } });
}

// Accepts a list of per-tier prices for one robot and upserts each RobotPrice row.
export async function updateRobotPrices(
  robotId: string,
  prices: { tier: string; amount: number; active?: boolean }[],
): Promise<ActionResult> {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "Unauthorized" };
  }
  if (!robotId) return { ok: false, error: "robotId is required" };

  // Confirm the robot exists (fail-closed) — never create price rows for a ghost robot.
  await prisma.robot.findUniqueOrThrow({ where: { id: robotId } });

  for (const row of prices) {
    // Validate tier against the enum via TIER_METADATA (the tier SSoT).
    const meta = TIER_METADATA[row.tier as keyof typeof TIER_METADATA];
    if (!meta) return { ok: false, error: `Unknown tier: ${row.tier}` };
    const tier: PricingTier = meta.enum;

    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return { ok: false, error: `Invalid amount for ${row.tier}` };
    }
    const active = row.active ?? true;

    await prisma.robotPrice.upsert({
      where: { robotId_tier: { robotId, tier } },
      update: { amount, active },
      create: { robotId, tier, amount, active },
    });
  }

  // Deploy-free price change (PRIC-04): refresh admin AND public catalog.
  revalidatePath("/dashboard/admin/robots");
  revalidatePath("/catalog");
  return { ok: true, message: "Prices saved" };
}
