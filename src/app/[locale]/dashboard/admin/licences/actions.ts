"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { accountHistoryCount, clearAccountHistory } from "@/lib/trial-abuse";
import { validateMT5Account } from "@/lib/validation";
import type { ActionResult } from "@/lib/action-result";

async function adminId() {
  const session = await getServerSession(authOptions);
  return session?.user?.role === "ADMIN" ? session.user.id : null;
}

/** How many licences have used this MT5 account, so the admin can see what allowing it clears. */
export async function countAccountUse(raw: string): Promise<ActionResult & { count?: number }> {
  if (!(await adminId())) return { ok: false, error: "Unauthorized" };
  const account = raw.trim();
  const check = validateMT5Account(account);
  if (!check.valid) return { ok: false, error: check.error ?? "That is not an MT5 account number." };

  const count = await accountHistoryCount(account);
  return { ok: true, count, message: `${count} ${count === 1 ? "licence has" : "licences have"} used ${account}.` };
}

/** Lets an MT5 account start a free trial again (see clearAccountHistory). */
export async function allowMt5Account(raw: string): Promise<ActionResult> {
  const admin = await adminId();
  if (!admin) return { ok: false, error: "Unauthorized" };
  const account = raw.trim();
  const check = validateMT5Account(account);
  if (!check.valid) return { ok: false, error: check.error ?? "That is not an MT5 account number." };

  const removed = await clearAccountHistory(account);
  console.log(`[Admin] ${admin} allowed MT5 account ${account} for a free trial again (${removed} history rows cleared)`);
  revalidatePath("/dashboard/admin/licences");
  return {
    ok: true,
    message:
      removed === 0
        ? `${account} had no history, so a free trial could already use it.`
        : `${account} can start a free trial again. Its licences keep working.`,
  };
}
