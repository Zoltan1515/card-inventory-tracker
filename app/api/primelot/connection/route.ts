import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type ConnectionRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  primelot_seller_user_id: string | null;
  primelot_seller_email: string | null;
  primelot_store_slug: string | null;
  status: "active" | "pending" | "disconnected" | string;
  requested_intent: "create" | "connect" | string | null;
  created_at: string | null;
  connected_at: string | null;
};

const jsonError = (message: string, status = 400, code?: string) => NextResponse.json({ error: message, code }, { status });
const missingTable = (message = "") => /relation .*primelot_connections.* does not exist|schema cache.*primelot_connections|Could not find the table/i.test(message);
const normalizeEmail = (email: unknown) => typeof email === "string" ? email.trim().toLowerCase() : "";
const normalizeStoreSlug = (value: unknown) => typeof value === "string"
  ? value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60)
  : "";

const rowToResponse = (row: ConnectionRow | null, migrationRequired = false) => ({
  connected: row?.status === "active" && Boolean(row.primelot_seller_user_id),
  status: row?.status || "none",
  sellerEmail: row?.primelot_seller_email || "",
  storeSlug: row?.primelot_store_slug || "",
  storeUrl: row?.primelot_store_slug ? `${(process.env.PRIMELOT_SITE_URL || "https://primelot.cards").replace(/\/$/, "")}/sellers/${row.primelot_store_slug}` : "",
  requestedIntent: row?.requested_intent || "",
  migrationRequired,
});

async function getAuthedClient(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return { error: jsonError("Wicked Card Tracker Supabase auth is not configured.", 503) };

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7) : "";
  if (!token) return { error: jsonError("Sign in before connecting PrimeLot.", 401) };

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { error: jsonError("Your Wicked Card Tracker session could not be verified.", 401) };
  return { supabase, user: data.user };
}

async function currentWorkspaceId(supabase: any, userId: string) {
  const { data } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", userId).limit(1).maybeSingle();
  return (data as { workspace_id?: string | null } | null)?.workspace_id ?? null;
}

async function findConnection(supabase: any, userId: string, workspaceId: string | null) {
  const baseSelect = "id,user_id,workspace_id,primelot_seller_user_id,primelot_seller_email,primelot_store_slug,status,requested_intent,created_at,connected_at";
  if (workspaceId) {
    const workspaceResult = await supabase
      .from("primelot_connections")
      .select(baseSelect)
      .eq("workspace_id", workspaceId)
      .neq("status", "disconnected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (workspaceResult.error) return workspaceResult;
    if (workspaceResult.data) return workspaceResult;
  }
  return supabase
    .from("primelot_connections")
    .select(baseSelect)
    .eq("user_id", userId)
    .is("workspace_id", null)
    .neq("status", "disconnected")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function GET(request: NextRequest) {
  const authed = await getAuthedClient(request);
  if (authed.error) return authed.error;
  const { supabase, user } = authed;
  const workspaceId = await currentWorkspaceId(supabase, user.id);
  const { data, error } = await findConnection(supabase, user.id, workspaceId);
  if (error) {
    if (missingTable(error.message)) return NextResponse.json(rowToResponse(null, true));
    return jsonError(`Could not load PrimeLot connection: ${error.message}`, 500);
  }
  return NextResponse.json(rowToResponse(data as ConnectionRow | null));
}

export async function POST(request: NextRequest) {
  const authed = await getAuthedClient(request);
  if (authed.error) return authed.error;
  const { supabase, user } = authed;

  let body: { intent?: string; sellerEmail?: string; storeSlug?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON payload.");
  }

  const intent = body.intent === "create" ? "create" : "connect";
  const sellerEmail = normalizeEmail(body.sellerEmail || user.email || "");
  const storeSlug = normalizeStoreSlug(body.storeSlug || sellerEmail.split("@")[0] || "");
  if (!sellerEmail) return jsonError("Enter the PrimeLot account email to continue.");

  const workspaceId = await currentWorkspaceId(supabase, user.id);
  const existing = await findConnection(supabase, user.id, workspaceId);
  if (existing.error && !missingTable(existing.error.message)) return jsonError(`Could not check PrimeLot connection: ${existing.error.message}`, 500);
  if (existing.error && missingTable(existing.error.message)) return jsonError("PrimeLot connection storage is not set up yet. Run supabase-primelot-connections-migration.sql before enabling self-serve connections.", 503, "PRIMELOT_CONNECTION_MIGRATION_REQUIRED");

  const autoApproveEmail = normalizeEmail(process.env.PRIMELOT_AUTO_APPROVE_EMAIL);
  const fallbackSellerId = process.env.PRIMELOT_SELLER_USER_ID || "";
  const shouldAutoApprove = Boolean(
    fallbackSellerId && (
      intent === "connect" ||
      !autoApproveEmail ||
      sellerEmail === autoApproveEmail
    )
  );

  const payload = {
    user_id: user.id,
    workspace_id: workspaceId,
    primelot_seller_user_id: shouldAutoApprove ? fallbackSellerId : null,
    primelot_seller_email: sellerEmail,
    primelot_store_slug: storeSlug || null,
    status: shouldAutoApprove ? "active" : "pending",
    requested_intent: intent,
    connected_at: shouldAutoApprove ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const query = existing.data?.id
    ? supabase.from("primelot_connections").update(payload).eq("id", existing.data.id).select("id,user_id,workspace_id,primelot_seller_user_id,primelot_seller_email,primelot_store_slug,status,requested_intent,created_at,connected_at").single()
    : supabase.from("primelot_connections").insert(payload).select("id,user_id,workspace_id,primelot_seller_user_id,primelot_seller_email,primelot_store_slug,status,requested_intent,created_at,connected_at").single();

  const { data, error } = await query;
  if (error) return jsonError(`Could not save PrimeLot connection request: ${error.message}`, 500);
  return NextResponse.json(rowToResponse(data as ConnectionRow));
}
