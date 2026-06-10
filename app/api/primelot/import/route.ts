import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/serverSupabase";
import {
  normalizePrimeLotEmail,
  normalizePrimeLotSellerUserId,
  primeLotListingsToWctRows,
  primeLotPurchasePriceFromAny,
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

type DuplicateCardRow = {
  id: string;
  status: string | null;
  purchase_price: number | string | null;
  notes: string | null;
};

const jsonError = (status: number, code: string, error: string, extra: Record<string, unknown> = {}) => (
  NextResponse.json({ ok: false, code, error, ...extra }, { status })
);
const schemaMissingSourceTracking = (message = "") => /source_platform|source_id|source_url|source_listing_type/i.test(message)
  && /schema cache|column|Could not find/i.test(message);
const missingColumnName = (message = "") => message.match(/Could not find the '([^']+)' column/i)?.[1] || "";
const primeLotTablesByListingType: Record<string, string> = {
  single_card: "single_cards",
  sealed_product: "sealed_products",
  lot: "lots",
};
const allPrimeLotSourceTables = Object.values(primeLotTablesByListingType);

const optionalInsertColumns = new Set([
  "workspace_id",
  "outbound_shipping",
  "grading_company",
  "grade",
  "front_photo_url",
  "back_photo_url",
  "created_by",
  "updated_by",
  "source_platform",
  "source_id",
  "source_url",
  "source_listing_type",
]);

class StructuredImportError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

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
    .select("id,status,purchase_price,notes")
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
    .select("id,status,purchase_price,notes")
    .eq("user_id", row.user_id)
    .ilike("notes", `%PrimeLot Listing ID: ${row.source_id}%`)
    .limit(1)
    .maybeSingle();
}

const primeLotListingUrlFromRow = (row: WctCardInsert) => {
  const sourceUrl = typeof row.source_url === "string" ? row.source_url.trim() : "";
  if (sourceUrl) return sourceUrl;
  const match = String(row.notes || "").match(/PrimeLot Listing URL:\s*(https?:\/\/\S+)/i);
  return match?.[1]?.trim() || "";
};

const primeLotListingIdCandidates = (listing: NormalizedPrimeLotListing) => {
  const candidates = new Set<string>();
  const add = (value: unknown) => {
    const raw = textValue(value);
    if (!raw) return;
    candidates.add(raw);
    try {
      const url = new URL(raw);
      const lastPathPart = url.pathname.split("/").filter(Boolean).pop();
      if (lastPathPart) candidates.add(lastPathPart);
    } catch {
      const lastPathPart = raw.split(/[/?#]/).filter(Boolean).pop();
      if (lastPathPart && lastPathPart !== raw) candidates.add(lastPathPart);
    }
  };
  add(listing.primeLotListingId);
  add(listing.sourceUrl);
  add(listing.row.source_url);
  add(primeLotListingUrlFromRow(listing.row));
  return [...candidates];
};

const primeLotListingLinkFilters = (row: WctCardInsert) => {
  const sourceId = String(row.source_id || "").trim();
  const sourceUrl = primeLotListingUrlFromRow(row);
  return [
    sourceId ? `listing_url.ilike.%${sourceId}%` : "",
    sourceId ? `notes.ilike.%${sourceId}%` : "",
    sourceUrl ? `listing_url.ilike.%${sourceUrl}%` : "",
    sourceUrl ? `notes.ilike.%${sourceUrl}%` : "",
  ].filter(Boolean).join(",");
};

async function findDuplicateByPrimeLotListingLink(supabase: ReturnType<typeof createServerSupabaseClient>, row: WctCardInsert) {
  const filters = primeLotListingLinkFilters(row);
  if (!filters) return { data: null, error: null };
  return supabase
    .from("cards")
    .select("id,status,purchase_price,notes")
    .eq("user_id", row.user_id)
    .or(filters)
    .order("purchase_price", { ascending: false })
    .limit(1)
    .maybeSingle();
}

const numberValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const textValue = (value: unknown) => String(value || "").trim();
const diagnosticKeyPattern = /source|wct|cost|purchase|paid|price|card|listing|url|type/i;
const diagnosticKeys = (value: unknown) => {
  if (!value || typeof value !== "object") return [];
  return Object.keys(value as Record<string, unknown>).filter((key) => diagnosticKeyPattern.test(key)).sort();
};
const diagnosticValueSummary = (value: unknown) => {
  if (typeof value === "number" || typeof value === "boolean") return value;
  const text = textValue(value);
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      return `${url.origin}${url.pathname}`;
    } catch {
      return text.slice(0, 160);
    }
  }
  return text.slice(0, 160);
};
const diagnosticPickedValues = (value: unknown) => {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(diagnosticKeys(value).map((key) => [key, diagnosticValueSummary((value as Record<string, unknown>)[key])]));
};
const recoveryNotes = (notes: unknown) => textValue(notes).split("\n").filter((line) => /PrimeLot Cost Recovery|Source: PrimeLot|PrimeLot Listing ID|PrimeLot Listing URL|PrimeLot Listing Type/i.test(line));
const primeLotSourceCardId = (value: unknown) => {
  if (!value || typeof value !== "object") return "";
  const row = value as Record<string, unknown>;
  return textValue(row.source_id)
    || textValue(row.sourceId)
    || textValue(row.wct_card_id)
    || textValue(row.wctCardId)
    || textValue(row.card_tracker_id)
    || textValue(row.cardTrackerId);
};

async function findWctOriginByPrimeLotSourceRow(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  listing: NormalizedPrimeLotListing,
  sourceRow: unknown,
) {
  const sourceCardId = primeLotSourceCardId(sourceRow);
  if (!sourceCardId) return { data: null, error: null };
  return supabase
    .from("cards")
    .select("id,status,purchase_price,notes")
    .eq("user_id", listing.row.user_id)
    .eq("id", sourceCardId)
    .limit(1)
    .maybeSingle();
}

async function refreshDuplicateMissingCost(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  duplicate: DuplicateCardRow,
  listing: NormalizedPrimeLotListing,
) {
  const incomingPurchasePrice = numberValue(listing.row.purchase_price);
  const existingPurchasePrice = numberValue(duplicate.purchase_price);
  if (incomingPurchasePrice <= 0 || existingPurchasePrice > 0) return null;

  const updatePayload: Record<string, unknown> = {
    purchase_price: incomingPurchasePrice,
    updated_by: listing.row.updated_by,
  };
  if (listing.row.notes && !String(duplicate.notes || "").includes(`PrimeLot Imported At:`)) {
    updatePayload.notes = [duplicate.notes, listing.row.notes].filter(Boolean).join("\n\n");
  }

  const { error } = await supabase
    .from("cards")
    .update(updatePayload)
    .eq("id", duplicate.id)
    .eq("user_id", listing.row.user_id);
  if (error) throw error;
  return incomingPurchasePrice;
}

async function insertCard(supabase: ReturnType<typeof createServerSupabaseClient>, listing: NormalizedPrimeLotListing) {
  let row: Record<string, unknown> = { ...listing.row };
  const removedColumns: string[] = [];

  for (let attempt = 0; attempt <= optionalInsertColumns.size; attempt += 1) {
    const { data, error } = await supabase
      .from("cards")
      .insert(row)
      .select("id,status")
      .single();

    if (!error) {
      const usedSourceColumns = !removedColumns.some((column) => column.startsWith("source_"));
      return { data, usedSourceColumns, removedColumns };
    }

    const missingColumn = missingColumnName(error.message);
    if (!missingColumn || !optionalInsertColumns.has(missingColumn) || !(missingColumn in row)) {
      return { error, removedColumns };
    }

    const { [missingColumn]: _removed, ...nextRow } = row;
    row = nextRow;
    removedColumns.push(missingColumn);

    if (missingColumn.startsWith("source_")) {
      row = rowWithoutSourceTracking(row as WctCardInsert);
      for (const sourceColumn of ["source_platform", "source_id", "source_url", "source_listing_type"]) {
        if (!removedColumns.includes(sourceColumn)) removedColumns.push(sourceColumn);
      }
    }
  }

  return {
    error: { message: "Could not save the card because WCT schema fallback exceeded the expected optional columns." },
    removedColumns,
  };
}

const withRecoveryNote = (listing: NormalizedPrimeLotListing, message: string, purchasePrice?: number): NormalizedPrimeLotListing => ({
  ...listing,
  row: {
    ...listing.row,
    ...(purchasePrice && purchasePrice > 0 ? { purchase_price: purchasePrice } : {}),
    notes: `${listing.row.notes}
PrimeLot Cost Recovery: ${message}`,
  },
});

async function enrichListingsFromWctOrigin(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  listings: NormalizedPrimeLotListing[],
) {
  const enriched: NormalizedPrimeLotListing[] = [];
  for (const listing of listings) {
    if (numberValue(listing.row.purchase_price) > 0) {
      enriched.push(listing);
      continue;
    }

    const origin = await findDuplicateByPrimeLotListingLink(supabase, listing.row);
    if (origin.error) throw origin.error;
    const originPurchasePrice = numberValue(origin.data?.purchase_price);
    if (origin.data?.id && originPurchasePrice > 0) {
      enriched.push(withRecoveryNote(
        listing,
        `Recovered $${originPurchasePrice.toFixed(2)} from the original WCT card already linked to this PrimeLot listing.`,
        originPurchasePrice,
      ));
      continue;
    }

    enriched.push(listing);
  }
  return enriched;
}

async function enrichListingsFromPrimeLotSource(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  listings: NormalizedPrimeLotListing[],
) {
  const primeLotSupabaseUrl = process.env.PRIMELOT_SUPABASE_URL;
  const primeLotServiceRoleKey = process.env.PRIMELOT_SUPABASE_SERVICE_ROLE_KEY;
  if (!primeLotSupabaseUrl || !primeLotServiceRoleKey) {
    return listings.map((listing) => numberValue(listing.row.purchase_price) > 0
      ? listing
      : withRecoveryNote(listing, "PrimeLot DB fallback not configured on WCT."));
  }

  const primeLotSupabase = createClient(primeLotSupabaseUrl, primeLotServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const enriched: NormalizedPrimeLotListing[] = [];
  for (const listing of listings) {
    if (numberValue(listing.row.purchase_price) > 0) {
      enriched.push(listing);
      continue;
    }

    const primaryTable = primeLotTablesByListingType[listing.listingType];
    const idCandidates = primeLotListingIdCandidates(listing);
    if (!primaryTable || !idCandidates.length) {
      enriched.push(withRecoveryNote(listing, `Skipped because listing type ${listing.listingType || "unknown"} or PrimeLot ID was missing.`));
      continue;
    }

    let data: Record<string, unknown> | null = null;
    let foundTable = primaryTable;
    let lookupErrorMessage = "";
    for (const table of [primaryTable, ...allPrimeLotSourceTables.filter((candidate) => candidate !== primaryTable)]) {
      const result = await primeLotSupabase
        .from(table)
        .select("*")
        .in("id", idCandidates)
        .limit(1)
        .maybeSingle();

      if (result.error) {
        lookupErrorMessage = `${table}: ${result.error.message}`;
        continue;
      }
      if (result.data) {
        data = result.data as Record<string, unknown>;
        foundTable = table;
        break;
      }
    }

    if (!data) {
      const details = lookupErrorMessage ? ` Last lookup error: ${lookupErrorMessage}.` : "";
      enriched.push(withRecoveryNote(listing, `PrimeLot source row was not found in ${[primaryTable, ...allPrimeLotSourceTables.filter((candidate) => candidate !== primaryTable)].join(", ")} for ${idCandidates.join(", ")}.${details}`));
      continue;
    }

    const wctOrigin = await findWctOriginByPrimeLotSourceRow(supabase, listing, data);
    if (wctOrigin.error) {
      enriched.push(withRecoveryNote(listing, `PrimeLot ${foundTable} source row was found, but WCT source-card lookup failed: ${wctOrigin.error.message}`));
      continue;
    }
    const sourceCardPurchasePrice = numberValue(wctOrigin.data?.purchase_price);
    if (wctOrigin.data?.id && sourceCardPurchasePrice > 0) {
      enriched.push(withRecoveryNote(
        listing,
        `Recovered $${sourceCardPurchasePrice.toFixed(2)} from the original WCT card referenced by the PrimeLot source row.`,
        sourceCardPurchasePrice,
      ));
      continue;
    }

    const recoveredPurchasePrice = primeLotPurchasePriceFromAny(data);
    if (recoveredPurchasePrice <= 0) {
      const availableCostKeys = Object.keys(data).filter((key) => /cost|purchase|paid|price/i.test(key)).sort().join(", ") || "none";
      enriched.push(withRecoveryNote(listing, `PrimeLot ${foundTable} row found, but no purchase cost was present. Cost-like fields: ${availableCostKeys}.`));
      continue;
    }

    enriched.push(withRecoveryNote(listing, `Recovered $${recoveredPurchasePrice.toFixed(2)} from PrimeLot ${foundTable} source row.`, recoveredPurchasePrice));
  }
  return enriched;
}

async function importListing(supabase: ReturnType<typeof createServerSupabaseClient>, listing: NormalizedPrimeLotListing): Promise<ImportItemResult> {
  const duplicate = await findDuplicateBySourceColumns(supabase, listing.row);
  if (duplicate.error && !schemaMissingSourceTracking(duplicate.error.message)) throw duplicate.error;
  if (duplicate.data?.id) {
    const refreshedCost = await refreshDuplicateMissingCost(supabase, duplicate.data as DuplicateCardRow, listing);
    return {
      primeLotListingId: listing.primeLotListingId,
      wctCardId: duplicate.data.id,
      status: "Not Listed",
      action: "skipped_duplicate",
      warnings: refreshedCost ? [`Existing WCT card was already imported; filled missing purchase price with $${refreshedCost.toFixed(2)}.`] : [],
    };
  }

  if (duplicate.error && schemaMissingSourceTracking(duplicate.error.message)) {
    const notesDuplicate = await findDuplicateByNotes(supabase, listing.row);
    if (notesDuplicate.error) throw notesDuplicate.error;
    if (notesDuplicate.data?.id) {
      const refreshedCost = await refreshDuplicateMissingCost(supabase, notesDuplicate.data as DuplicateCardRow, listing);
      return {
        primeLotListingId: listing.primeLotListingId,
        wctCardId: notesDuplicate.data.id,
        status: "Not Listed",
        action: "skipped_duplicate",
        warnings: [
          "Source tracking columns are not available; duplicate was detected from notes metadata.",
          ...(refreshedCost ? [`Existing WCT card was already imported; filled missing purchase price with $${refreshedCost.toFixed(2)}.`] : []),
        ],
      };
    }
  }

  const linkedDuplicate = await findDuplicateByPrimeLotListingLink(supabase, listing.row);
  if (linkedDuplicate.error) throw linkedDuplicate.error;
  if (linkedDuplicate.data?.id) {
    const refreshedCost = await refreshDuplicateMissingCost(supabase, linkedDuplicate.data as DuplicateCardRow, listing);
    return {
      primeLotListingId: listing.primeLotListingId,
      wctCardId: linkedDuplicate.data.id,
      status: "Not Listed",
      action: "skipped_duplicate",
      warnings: [
        "Existing WCT card already has this PrimeLot listing link; skipped duplicate import.",
        ...(refreshedCost ? [`Existing WCT card was already imported; filled missing purchase price with $${refreshedCost.toFixed(2)}.`] : []),
      ],
    };
  }

  const inserted = await insertCard(supabase, listing);
  if (inserted.error) {
    throw new StructuredImportError(422, "WCT_CARD_INSERT_FAILED", "Wicked Card Tracker could not save this PrimeLot listing as a card.", {
      primeLotListingId: listing.primeLotListingId,
      supabaseCode: "code" in inserted.error ? inserted.error.code : undefined,
      message: inserted.error.message,
      removedColumns: inserted.removedColumns || [],
    });
  }
  const warnings = [
    ...(inserted.usedSourceColumns ? [] : ["Source tracking columns are not available; PrimeLot source metadata was preserved in notes."]),
    ...((inserted.removedColumns || []).filter((column) => !column.startsWith("source_")).length
      ? [`WCT schema is missing optional columns skipped during import: ${(inserted.removedColumns || []).filter((column) => !column.startsWith("source_")).join(", ")}.`]
      : []),
  ];
  return {
    primeLotListingId: listing.primeLotListingId,
    wctCardId: inserted.data.id,
    status: "Not Listed",
    action: "created",
    warnings,
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
    const mappedListings = primeLotListingsToWctRows(payload, connection.user_id, connection.workspace_id);
    const listings = await enrichListingsFromPrimeLotSource(supabase, await enrichListingsFromWctOrigin(supabase, mappedListings));
    console.info("PrimeLot WCT import diagnostics", JSON.stringify({
      eventId: textValue(payload.eventId).slice(0, 80),
      listingCount: listings.length,
      items: listings.map((listing, index) => {
        const rawListing = Array.isArray(payload.listings) ? payload.listings[index] : null;
        const mapped = mappedListings[index];
        return {
          index,
          primeLotListingId: listing.primeLotListingId,
          listingType: listing.listingType,
          sourceUrl: diagnosticValueSummary(listing.sourceUrl),
          inboundDiagnosticKeys: diagnosticKeys(rawListing),
          inboundDiagnosticValues: diagnosticPickedValues(rawListing),
          mappedPurchasePrice: numberValue(mapped?.row.purchase_price),
          enrichedPurchasePrice: numberValue(listing.row.purchase_price),
          sourceId: diagnosticValueSummary(listing.row.source_id),
          recoveryNotes: recoveryNotes(listing.row.notes),
        };
      }),
    }));
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
    if (error instanceof StructuredImportError) {
      return jsonError(error.status, error.code, error.message, { details: error.details });
    }
    const message = error instanceof Error ? error.message : "Unknown import error.";
    return jsonError(502, "WCT_IMPORT_UNEXPECTED_ERROR", "Wicked Card Tracker could not finish the PrimeLot import.", { details: { message } });
  }
}
