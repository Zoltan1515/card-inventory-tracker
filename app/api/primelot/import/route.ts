import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/serverSupabase";
import {
  normalizePrimeLotEmail,
  normalizePrimeLotSellerUserId,
  primeLotListingsToWctRows,
  rowWithoutSourceTracking,
  validatePrimeLotImportPayload,
  type NormalizedPrimeLotListing,
  type PrimeLotImportPayload,
  type WctCardInsert,
} from "@/lib/primelotToWctImport";

export const dynamic = "force-dynamic";

type ConnectionRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  primelot_seller_user_id: string | null;
  primelot_seller_email: string | null;
  status: string;
};

type ImportItemResult = {
  primeLotListingId: string;
  wctCardId: string;
  status: "Not Listed";
  action: "created" | "skipped_duplicate";
  warnings: string[];
};

const jsonError = (status: number, code: string, error: string, extra: Record<string, unknown> = {}) => (
  NextResponse.json({ ok: false, code, error, ...extra }, { status })
);
const schemaMissingSourceTracking = (message = "") => /source_platform|source_id|source_url|source_listing_type/i.test(message)
  && /schema cache|column|Could not find/i.test(message);

function timingSafeEqualString(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

function validateSecret(request: NextRequest) {
  const expectedSecret = process.env.PRIMELOT_TO_WCT_IMPORT_SECRET || "";
  const receivedSecret = request.headers.get("x-wct-webhook-secret") || "";
  return Boolean(expectedSecret && timingSafeEqualString(receivedSecret, expectedSecret));
}

async function findConnectionRows(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  field: "primelot_seller_user_id" | "primelot_seller_email",
  value: string,
) {
  const baseSelect = "id,user_id,workspace_id,primelot_seller_user_id,primelot_seller_email,status";
  const { data, error } = await supabase
    .from("primelot_connections")
    .select(baseSelect)
    .eq("status", "active")
    .eq(field, value)
    .limit(2);
  if (error) throw error;
  return (data || []) as ConnectionRow[];
}

function resolveConnectionRows(rows: ConnectionRow[]) {
  if (rows.length > 1) return { error: jsonError(409, "AMBIGUOUS_WCT_ACCOUNT", "Multiple Wicked Card Tracker accounts match this PrimeLot seller.") };
  if (rows.length === 1) return { connection: rows[0] };
  return null;
}

async function resolveConnection(supabase: ReturnType<typeof createServerSupabaseClient>, payload: PrimeLotImportPayload) {
  const sellerId = normalizePrimeLotSellerUserId(payload.primeLotSellerUserId);
  const sellerEmail = normalizePrimeLotEmail(payload.primeLotSellerEmail);

  if (sellerId) {
    const resolvedById = resolveConnectionRows(await findConnectionRows(supabase, "primelot_seller_user_id", sellerId));
    if (resolvedById) return resolvedById;
  }

  if (sellerEmail) {
    const resolvedByEmail = resolveConnectionRows(await findConnectionRows(supabase, "primelot_seller_email", sellerEmail));
    if (resolvedByEmail) return resolvedByEmail;
  }

  return { error: jsonError(404, "WCT_ACCOUNT_NOT_CONNECTED", "No active Wicked Card Tracker account is connected to this PrimeLot seller.") };
}

async function findDuplicateBySourceColumns(supabase: ReturnType<typeof createServerSupabaseClient>, row: WctCardInsert) {
  const query = supabase
    .from("cards")
    .select("id,status")
    .eq("user_id", row.user_id)
    .eq("source_platform", "primelot")
    .eq("source_id", row.source_id || "")
    .limit(1)
    .maybeSingle();
  return query;
}

async function findDuplicateByNotes(supabase: ReturnType<typeof createServerSupabaseClient>, row: WctCardInsert) {
  return supabase
    .from("cards")
    .select("id,status")
    .eq("user_id", row.user_id)
    .ilike("notes", `%PrimeLot Listing ID: ${row.source_id}%`)
    .limit(1)
    .maybeSingle();
}

async function insertCard(supabase: ReturnType<typeof createServerSupabaseClient>, listing: NormalizedPrimeLotListing) {
  const { data, error } = await supabase
    .from("cards")
    .insert(listing.row)
    .select("id,status")
    .single();

  if (!error) return { data, usedSourceColumns: true };
  if (!schemaMissingSourceTracking(error.message)) return { error };

  const fallback = await supabase
    .from("cards")
    .insert(rowWithoutSourceTracking(listing.row))
    .select("id,status")
    .single();
  if (fallback.error) return { error: fallback.error };
  return { data: fallback.data, usedSourceColumns: false };
}

async function importListing(supabase: ReturnType<typeof createServerSupabaseClient>, listing: NormalizedPrimeLotListing): Promise<ImportItemResult> {
  const duplicate = await findDuplicateBySourceColumns(supabase, listing.row);
  if (duplicate.error && !schemaMissingSourceTracking(duplicate.error.message)) throw duplicate.error;
  if (duplicate.data?.id) {
    return {
      primeLotListingId: listing.primeLotListingId,
      wctCardId: duplicate.data.id,
      status: "Not Listed",
      action: "skipped_duplicate",
      warnings: [],
    };
  }

  if (duplicate.error && schemaMissingSourceTracking(duplicate.error.message)) {
    const notesDuplicate = await findDuplicateByNotes(supabase, listing.row);
    if (notesDuplicate.error) throw notesDuplicate.error;
    if (notesDuplicate.data?.id) {
      return {
        primeLotListingId: listing.primeLotListingId,
        wctCardId: notesDuplicate.data.id,
        status: "Not Listed",
        action: "skipped_duplicate",
        warnings: ["Source tracking columns are not available; duplicate was detected from notes metadata."],
      };
    }
  }

  const inserted = await insertCard(supabase, listing);
  if (inserted.error) throw inserted.error;
  return {
    primeLotListingId: listing.primeLotListingId,
    wctCardId: inserted.data.id,
    status: "Not Listed",
    action: "created",
    warnings: inserted.usedSourceColumns ? [] : ["Source tracking columns are not available; PrimeLot source metadata was preserved in notes."],
  };
}

export async function POST(request: NextRequest) {
  if (!validateSecret(request)) {
    return jsonError(401, "UNAUTHORIZED", "Invalid PrimeLot import secret.");
  }

  let payload: PrimeLotImportPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "Invalid JSON payload.", { details: [{ field: "body", message: "Request body must be valid JSON." }] });
  }

  const validationIssues = validatePrimeLotImportPayload(payload);
  if (validationIssues.length > 0) {
    return jsonError(400, "VALIDATION_ERROR", "One or more listings are invalid.", { details: validationIssues });
  }

  let supabase: ReturnType<typeof createServerSupabaseClient>;
  try {
    supabase = createServerSupabaseClient();
  } catch {
    return jsonError(500, "WCT_IMPORT_FAILED", "Could not import PrimeLot listings into Wicked Card Tracker.");
  }

  try {
    const resolved = await resolveConnection(supabase, payload);
    if (resolved.error) return resolved.error;
    const connection = resolved.connection!;
    const listings = primeLotListingsToWctRows(payload, connection.user_id, connection.workspace_id);
    const items: ImportItemResult[] = [];

    for (const listing of listings) {
      items.push(await importListing(supabase, listing));
    }

    return NextResponse.json({
      ok: true,
      importedCount: items.filter((item) => item.action === "created").length,
      skippedCount: items.filter((item) => item.action === "skipped_duplicate").length,
      mode: "not_listed",
      items,
    });
  } catch (error) {
    console.error("PrimeLot import failed", error);
    return jsonError(500, "WCT_IMPORT_FAILED", "Could not import PrimeLot listings into Wicked Card Tracker.");
  }
}
