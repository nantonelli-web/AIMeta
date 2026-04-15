import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseTemplate } from "@/lib/report/parse-template";

/**
 * GET /api/report/templates?client_id=xxx
 * List templates for a client.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const clientId = url.searchParams.get("client_id");

  const { data: profile } = await supabase
    .from("mait_users")
    .select("workspace_id")
    .eq("id", user.id)
    .single();
  if (!profile?.workspace_id)
    return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const admin = createAdminClient();
  let query = admin
    .from("mait_client_templates")
    .select("id, client_id, name, file_type, theme_config, created_at")
    .eq("workspace_id", profile.workspace_id)
    .order("created_at", { ascending: false });

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/**
 * POST /api/report/templates
 * Upload a template file (multipart form: file + client_id + name).
 */
export async function POST(req: Request) {
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
  if (!profile?.workspace_id || !["super_admin", "admin", "analyst"].includes(profile.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const clientId = formData.get("client_id") as string | null;
  const name = formData.get("name") as string | null;

  if (!file || !clientId || !name) {
    return NextResponse.json(
      { error: "Missing required fields: file, client_id, name" },
      { status: 400 }
    );
  }

  if (!file.name.endsWith(".pptx")) {
    return NextResponse.json({ error: "Only .pptx files are supported" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Ensure storage bucket exists
  const { data: buckets } = await admin.storage.listBuckets();
  const bucketExists = buckets?.some((b) => b.name === "templates");
  if (!bucketExists) {
    const { error: bucketErr } = await admin.storage.createBucket("templates", {
      public: false,
    });
    if (bucketErr && !bucketErr.message.includes("already exists")) {
      console.error("[templates] Failed to create bucket:", bucketErr);
      return NextResponse.json({ error: "Storage setup failed" }, { status: 500 });
    }
  }

  // Upload to storage
  const fileBuffer = await file.arrayBuffer();
  const storagePath = `${profile.workspace_id}/${clientId}/${Date.now()}_${file.name}`;

  const { error: uploadErr } = await admin.storage
    .from("templates")
    .upload(storagePath, fileBuffer, {
      contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      upsert: false,
    });

  if (uploadErr) {
    console.error("[templates] Upload failed:", uploadErr);
    return NextResponse.json({ error: "File upload failed" }, { status: 500 });
  }

  // Parse PPTX to extract theme config
  let themeConfig;
  try {
    themeConfig = await parseTemplate(fileBuffer);
  } catch (err) {
    console.warn("[templates] Template parsing failed, using defaults:", err);
    const { DEFAULT_THEME } = await import("@/lib/report/parse-template");
    themeConfig = { ...DEFAULT_THEME };
  }

  // Save record
  const { data: record, error: insertErr } = await admin
    .from("mait_client_templates")
    .insert({
      workspace_id: profile.workspace_id,
      client_id: clientId,
      name,
      storage_path: storagePath,
      file_type: "pptx",
      theme_config: themeConfig,
    })
    .select("id, client_id, name, file_type, theme_config, created_at")
    .single();

  if (insertErr) {
    console.error("[templates] Insert failed:", insertErr);
    // Clean up uploaded file
    await admin.storage.from("templates").remove([storagePath]);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json(record);
}
