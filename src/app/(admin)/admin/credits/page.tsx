import { createAdminClient } from "@/lib/supabase/admin";
import { CreditManager } from "./credit-manager";

export const dynamic = "force-dynamic";

export default async function AdminCreditsPage() {
  const admin = createAdminClient();

  const [{ data: history }, { data: users }] = await Promise.all([
    admin
      .from("mait_credits_history")
      .select("id, user_id, amount, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("mait_users")
      .select("id, name, email")
      .order("name", { ascending: true }),
  ]);

  // Build user lookup for history display
  const userMap: Record<string, { name: string; email: string }> =
    Object.fromEntries(
      (users ?? []).map((u) => [
        u.id,
        { name: u.name ?? "—", email: u.email },
      ])
    );

  const enrichedHistory = (history ?? []).map((h) => ({
    ...h,
    user_name: userMap[h.user_id]?.name ?? "—",
    user_email: userMap[h.user_id]?.email ?? "—",
  }));

  const userOptions = (users ?? []).map((u) => ({
    id: u.id,
    label: `${u.name ?? "No name"} (${u.email})`,
  }));

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-serif tracking-tight">
          Credit Management
        </h1>
        <p className="text-sm text-muted-foreground">
          Adjust credits and view transaction history
        </p>
      </div>

      <CreditManager history={enrichedHistory} userOptions={userOptions} />
    </div>
  );
}
