"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { uploadEncryptedSource } from "@/lib/source-storage";
import { Prisma } from "@prisma/client";

export async function toggleRobotActive(robotId: string, currentActive: boolean) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  await prisma.robot.update({
    where: { id: robotId },
    data: { active: !currentActive },
  });

  revalidatePath("/dashboard/admin/robots");
  return { success: true };
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
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const name = data.name?.trim();
  const shortDescription = data.shortDescription?.trim();
  if (!name || !shortDescription) {
    throw new Error("Name and short description are required");
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
  return { success: true };
}

export async function createRobot(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const slug = String(formData.get("slug") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const shortDescription = String(formData.get("shortDescription") || "").trim();
  const longDescription = String(formData.get("longDescription") || "").trim();
  const artworkUrlRaw = String(formData.get("artworkUrl") || "").trim();
  const sortOrder = Math.trunc(Number(formData.get("sortOrder") || 0));

  if (!slug || !name || !shortDescription) {
    throw new Error("Slug, name, and short description are required");
  }
  // slug shape guard: lowercase kebab (join key for Blob path)
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error("Slug must be lowercase letters, numbers, and hyphens only");
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
      throw new Error(`A robot with slug "${slug}" already exists`);
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
  return { success: true, id: robot.id };
}

export async function uploadRobotSource(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const robotId = String(formData.get("robotId") || "");
  const file = formData.get("source");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("A .mq5 source file is required");
  }

  const robot = await prisma.robot.findUniqueOrThrow({ where: { id: robotId } });
  const nextVersion = robot.sourceVersion + 1;
  const buf = Buffer.from(await file.arrayBuffer());

  // Upload FIRST (immutable put to a NEW version path) — only bump after it succeeds,
  // so a failed upload never leaves sourceVersion pointing at a missing blob.
  await uploadEncryptedSource(robot.slug, nextVersion, buf);
  await prisma.robot.update({ where: { id: robotId }, data: { sourceVersion: nextVersion } });

  revalidatePath("/dashboard/admin/robots");
  return { success: true, version: nextVersion };
}
