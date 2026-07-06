"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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
