import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { verifyAdminToken } from "@/lib/admin-jwt";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  userId: z.string().uuid(),
  amount: z.number().int().min(-10000).max(10000),
  reason: z.string().min(1).max(500),
});

/** Add or remove credits for a user (admin only) */
export async function POST(req: Request) {
  // Verify admin session
  const jar = await cookies();
  const token = jar.get("admin_session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await verifyAdminToken(token);
  if (!admin) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { userId, amount, reason } = parsed.data;
  const supabase = createAdminClient();

  if (amount > 0) {
    // Add credits
    await supabase.rpc("mait_add_credits", {
      p_user_id: userId,
      p_amount: amount,
      p_reason: `[Admin] ${reason}`,
    });
  } else if (amount < 0) {
    // Remove credits
    const { data: ok } = await supabase.rpc("mait_consume_credits", {
      p_user_id: userId,
      p_amount: Math.abs(amount),
      p_reason: `[Admin] ${reason}`,
      p_reference_id: null,
    });
    if (!ok) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: "Amount cannot be zero" }, { status: 400 });
  }

  // Fetch updated balance
  const { data: user } = await supabase
    .from("mait_users")
    .select("credits_balance")
    .eq("id", userId)
    .single();

  return NextResponse.json({ ok: true, balance: user?.credits_balance ?? 0 });
}
