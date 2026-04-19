import { createAdminClient } from "@/lib/supabase/admin";
import { UserManagement } from "./user-management";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = createAdminClient();

  const { data: users } = await admin
    .from("mait_users")
    .select(
      "id, name, email, role, workspace_id, credits_balance, created_at"
    )
    .order("created_at", { ascending: false });

  // Fetch workspace names to display alongside users
  const wsIds = [
    ...new Set(
      (users ?? [])
        .map((u) => u.workspace_id)
        .filter(Boolean) as string[]
    ),
  ];

  let workspaceMap: Record<string, string> = {};

  if (wsIds.length > 0) {
    const { data: workspaces } = await admin
      .from("mait_workspaces")
      .select("id, name")
      .in("id", wsIds);

    workspaceMap = Object.fromEntries(
      (workspaces ?? []).map((w) => [w.id, w.name])
    );
  }

  const enrichedUsers = (users ?? []).map((u) => ({
    ...u,
    workspace_name: u.workspace_id
      ? workspaceMap[u.workspace_id] ?? "—"
      : "—",
  }));

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-serif tracking-tight">User Management</h1>
        <p className="text-sm text-muted-foreground">
          View and manage all AISCAN users
        </p>
      </div>

      <UserManagement users={enrichedUsers} />
    </div>
  );
}
