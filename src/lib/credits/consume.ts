import { createAdminClient } from "@/lib/supabase/admin";
import { creditCosts, type CreditAction } from "@/config/pricing";

/**
 * Resolve the workspace owner — the user whose credits are consumed.
 * The owner is the first (oldest) member of the workspace.
 */
async function resolveOwnerId(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<string> {
  // Get the user's workspace
  const { data: user } = await admin
    .from("mait_users")
    .select("workspace_id")
    .eq("id", userId)
    .single();

  if (!user?.workspace_id) return userId; // fallback to self

  // Find the oldest member (workspace creator/owner)
  const { data: owner } = await admin
    .from("mait_users")
    .select("id")
    .eq("workspace_id", user.workspace_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  return owner?.id ?? userId;
}

/**
 * Check if the workspace has enough credits for an action.
 * Credits are checked on the workspace owner's balance.
 */
export async function checkCredits(
  userId: string,
  action: CreditAction
): Promise<{ ok: boolean; balance: number; cost: number }> {
  const cost = creditCosts[action];
  const admin = createAdminClient();
  const ownerId = await resolveOwnerId(admin, userId);

  const { data } = await admin
    .from("mait_users")
    .select("credits_balance")
    .eq("id", ownerId)
    .single();

  const balance = data?.credits_balance ?? 0;
  return { ok: balance >= cost, balance, cost };
}

/**
 * Consume credits for an action from the workspace owner's balance.
 * Uses the atomic PostgreSQL function `mait_consume_credits`.
 *
 * Returns { ok, balance } — ok=false if insufficient credits.
 */
export async function consumeCredits(
  userId: string,
  action: CreditAction,
  reason: string,
  referenceId?: string
): Promise<{ ok: boolean; balance: number }> {
  const cost = creditCosts[action];
  const admin = createAdminClient();
  const ownerId = await resolveOwnerId(admin, userId);

  const { data, error } = await admin.rpc("mait_consume_credits", {
    p_user_id: ownerId,
    p_amount: cost,
    p_reason: reason,
    p_reference_id: referenceId ?? null,
  });

  if (error) {
    console.error("[credits] consume error:", error);
    return { ok: false, balance: 0 };
  }

  const ok = data === true;

  // Fetch updated balance
  const { data: user } = await admin
    .from("mait_users")
    .select("credits_balance")
    .eq("id", ownerId)
    .single();

  return { ok, balance: user?.credits_balance ?? 0 };
}

/**
 * Refund credits to the workspace owner when an action fails.
 */
export async function refundCredits(
  userId: string,
  action: CreditAction,
  reason: string
): Promise<void> {
  const cost = creditCosts[action];
  const admin = createAdminClient();
  const ownerId = await resolveOwnerId(admin, userId);

  await admin.rpc("mait_add_credits", {
    p_user_id: ownerId,
    p_amount: cost,
    p_reason: `Refund: ${reason}`,
  });
}
