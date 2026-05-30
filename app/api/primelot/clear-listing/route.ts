import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type PrimeLotConnection = {
  primelot_seller_user_id: string | null;
  status: string | null;
};

const jsonError = (message: string, status = 400, code?: string) => NextResponse.json({ error: message, code }, { status });
const missingConnectionTable = (message = "") => /relation .*primelot_connections.* does not exist|schema cache.*primelot_connections|Could not find the table/i.test(message);
const sourceTrackingColumnError = (message = "") => /source_id|source_platform/i.test(message) && /schema cache|column|Could not find/i.test(message);

const primeLotListingIdFromUrl = (listingUrl?: string) => {
  const value = (listingUrl || "").trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const listingIndex = parts.findIndex((part) => part === "single-cards");
    if (listingIndex >= 0) return parts[listingIndex + 1] || "";
  } catch {
    const match = value.match(/single-cards\/([^/?#]+)/i);
    return match?.[1] || "";
  }
  return "";
};

async function resolvePrimeLotSellerUserId(cardTrackerSupabase: any, userId: string, workspaceId: string | null) {
  const connectionSelect = "primelot_seller_user_id,status";
  let connectionResult: any = workspaceId
    ? await cardTrackerSupabase
      .from("primelot_connections")
      .select(connectionSelect)
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle()
    : { data: null, error: null };

  if (!connectionResult.data && !connectionResult.error) {
    connectionResult = await cardTrackerSupabase
      .from("primelot_connections")
      .select(connectionSelect)
      .eq("user_id", userId)
      .is("workspace_id", null)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
  }

  if (connectionResult.error) {
    if (missingConnectionTable(connectionResult.error.message)) return process.env.PRIMELOT_SELLER_USER_ID || "";
    throw new Error(`Could not check your PrimeLot connection: ${connectionResult.error.message}`);
  }

  const primeLotConnection = connectionResult.data as PrimeLotConnection | null;
  return primeLotConnection?.primelot_seller_user_id || process.env.PRIMELOT_SELLER_USER_ID || "";
}

export async function POST(request: NextRequest) {
  const cardTrackerSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cardTrackerSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const primeLotSupabaseUrl = process.env.PRIMELOT_SUPABASE_URL;
  const primeLotServiceRoleKey = process.env.PRIMELOT_SUPABASE_SERVICE_ROLE_KEY;

  if (!cardTrackerSupabaseUrl || !cardTrackerSupabaseAnonKey) {
    return jsonError("Wicked Card Tracker Supabase auth is not configured.", 503);
  }
  if (!primeLotSupabaseUrl || !primeLotServiceRoleKey) {
    return jsonError("PrimeLot posting is not configured yet. Add PRIMELOT_SUPABASE_URL and PRIMELOT_SUPABASE_SERVICE_ROLE_KEY in Vercel.", 503, "PRIMELOT_NOT_CONFIGURED");
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7) : "";
  if (!token) return jsonError("Sign in before clearing a PrimeLot listing.", 401);

  const cardTrackerSupabase = createClient(cardTrackerSupabaseUrl, cardTrackerSupabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await cardTrackerSupabase.auth.getUser(token);
  if (authError || !authData.user) return jsonError("Your Wicked Card Tracker session could not be verified.", 401);

  let body: { cardTrackerId?: string; listingUrl?: string; primeLotListingId?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON payload.");
  }

  const cardTrackerId = (body.cardTrackerId || "").trim();
  const primeLotListingId = (body.primeLotListingId || primeLotListingIdFromUrl(body.listingUrl)).trim();
  if (!primeLotListingId && !cardTrackerId) return jsonError("A PrimeLot listing URL or Card Tracker ID is required.");

  const membershipResult = await cardTrackerSupabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", authData.user.id)
    .limit(1)
    .maybeSingle();
  const workspaceId = membershipResult.error ? null : membershipResult.data?.workspace_id ?? null;

  let primeLotSellerUserId = "";
  try {
    primeLotSellerUserId = await resolvePrimeLotSellerUserId(cardTrackerSupabase, authData.user.id, workspaceId);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not check your PrimeLot connection.", 500);
  }
  if (!primeLotSellerUserId) return jsonError("Connect a PrimeLot seller account before clearing PrimeLot listings.", 409, "PRIMELOT_NOT_CONNECTED");

  const primeLotSupabase = createClient(primeLotSupabaseUrl, primeLotServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let deleteResult = primeLotListingId
    ? await primeLotSupabase
      .from("single_cards")
      .delete()
      .eq("id", primeLotListingId)
      .eq("user_id", primeLotSellerUserId)
      .select("id")
    : await primeLotSupabase
      .from("single_cards")
      .delete()
      .eq("source_platform", "wickedcardtracker")
      .eq("source_id", cardTrackerId)
      .eq("user_id", primeLotSellerUserId)
      .select("id");

  if (deleteResult.error && !primeLotListingId && sourceTrackingColumnError(deleteResult.error.message)) {
    return jsonError("PrimeLot listing URL is missing, and source tracking is not available to find the listing automatically.", 400, "PRIMELOT_LISTING_URL_REQUIRED");
  }
  if (deleteResult.error) return jsonError(`PrimeLot could not remove the listing: ${deleteResult.error.message}`, 502);

  return NextResponse.json({ removedCount: deleteResult.data?.length || 0 });
}
