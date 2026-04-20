import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await getSessionUser();

  if (!profile.workspace_id) {
    redirect("/login?error=no_workspace");
  }

  return (
    <div className="flex flex-1 min-h-screen">
      <Sidebar userName={profile.name || profile.email} userEmail={profile.email} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-6 md:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
