import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * DELETE /api/report/templates/[id]
 * Remove a template (delete from storage + DB).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("mait_users")
    .select("workspace_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.workspace_id || !["super_admin", "admin"].includes(profile.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();

  // Fetch the template to get the storage path
  const { data: tmpl, error: fetchErr } = await admin
    .from("mait_client_templates")
    .select("id, storage_path, workspace_id")
    .eq("id", id)
    .single();

  if (fetchErr || !tmpl) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Verify workspace ownership
  if (tmpl.workspace_id !== profile.workspace_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete from storage
  if (tmpl.storage_path) {
    await admin.storage.from("templates").remove([tmpl.storage_path]);
  }

  // Delete from DB
  const { error: deleteErr } = await admin
    .from("mait_client_templates")
    .delete()
    .eq("id", id);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
