"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function toggleBlockUser(userId: string, currentBlockStatus: boolean) {
  const session = await getServerSession(authOptions) as any;
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  // Prevent blocking self
  if (userId === session.user.id) {
    throw new Error("You cannot block your own account");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isBlocked: !currentBlockStatus },
  });

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}

export async function deleteUser(userId: string) {
  const session = await getServerSession(authOptions) as any;
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  // Prevent deleting self
  if (userId === session.user.id) {
    throw new Error("You cannot delete your own account");
  }

  // Perform a soft delete by marking the user as deleted in the database.
  await prisma.user.update({
    where: { id: userId },
    data: { isDeleted: true },
  });

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}
