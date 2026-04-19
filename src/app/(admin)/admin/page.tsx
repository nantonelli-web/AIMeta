import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Building2, Zap, Coins } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const admin = createAdminClient();

  const [
    { count: totalUsers },
    { count: totalWorkspaces },
    { count: totalJobs },
    { data: creditRows },
  ] = await Promise.all([
    admin
      .from("mait_users")
      .select("id", { count: "exact", head: true }),
    admin
      .from("mait_workspaces")
      .select("id", { count: "exact", head: true }),
    admin
      .from("mait_scrape_jobs")
      .select("id", { count: "exact", head: true }),
    admin
      .from("mait_users")
      .select("credits_balance"),
  ]);

  const totalCredits = (creditRows ?? []).reduce(
    (sum, u) => sum + (u.credits_balance ?? 0),
    0
  );

  const stats = [
    {
      label: "Total Users",
      value: totalUsers ?? 0,
      icon: Users,
    },
    {
      label: "Workspaces",
      value: totalWorkspaces ?? 0,
      icon: Building2,
    },
    {
      label: "Scan Jobs",
      value: totalJobs ?? 0,
      icon: Zap,
    },
    {
      label: "Credits in Circulation",
      value: totalCredits,
      icon: Coins,
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-serif tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          AISCAN platform overview
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="size-10 rounded-lg bg-gold/10 border border-gold/30 grid place-items-center">
                <Icon className="size-5 text-gold" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  {label}
                </div>
                <div className="text-2xl font-semibold">
                  {new Intl.NumberFormat("en-US").format(value)}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
