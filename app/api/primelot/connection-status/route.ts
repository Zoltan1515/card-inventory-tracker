import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/serverSupabase";
import {
  normalizePrimeLotEmail,
  normalizePrimeLotSellerUserId,
} from "@/lib/primelotToWctImport";

export const dynamic = "force-dynamic";

type ConnectionStatusPayload = {
  source?: string;
  primeLotSellerUserId?: unknown;
  primeLotSellerEmail?: unknown;
};

type ConnectionRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  primelot_seller_user_id: string | null;
  primelot_seller_email: string | null;
  status: string;
};

const baseSelect = "id,user_id,workspace_id,primelot_seller_user_id,primelot_seller_email,status";

const jsonError = (status: number, code: string, error: string, extra: Record<string, unknown> = {}) => (
  NextResponse.json({ ok: false, code, error, ...extra }, { status })
);

function timingSafeEqualString(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

function validatePrimeLotServerAuth(request: NextRequest) {
  const expectedSecret = process.env.PRIMELOT_TO_WCT_IMPORT_SECRET || "";
  const receivedSecret = request.headers.get("x-wct-webhook-secret") || "";
  const integration = (request.headers.get("x-wct-integration") || "").trim().toLowerCase();
  return integration === "primelot" && Boolean(expectedSecret && timingSafeEqualString(receivedSecret, expectedSecret));
}

function connectionResponse(row: ConnectionRow) {
  return NextResponse.json({
    ok: true,
    connected: true,
    workspaceId: row.workspace_id || undefined,
    connectedEmail: row.primelot_seller_email || undefined,
  });
}

function inactiveResponse() {
  return NextResponse.json({ ok: true, connected: false });
}

async function findActiveConnections(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  field: "primelot_seller_user_id" | "primelot_seller_email",
  value: string,
) {
  const { data, error } = await supabase
    .from("primelot_connections")
    .select(baseSelect)
    .eq("status", "active")
    .eq(field, value)
    .limit(2);

  if (error) throw error;
  return (data || []) as ConnectionRow[];
}

function resolveRows(rows: ConnectionRow[]) {
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    return jsonError(409, "AMBIGUOUS_WCT_ACCOUNT", "Multiple active Wicked Card Tracker accounts match this PrimeLot seller.");
  }
  return connectionResponse(rows[0]);
}

export async function POST(request: NextRequest) {
  if (!validatePrimeLotServerAuth(request)) {
    return jsonError(401, "UNAUTHORIZED", "Invalid PrimeLot connection-status secret.");
  }

  let payload: ConnectionStatusPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "Invalid JSON payload.", { details: [{ field: "body", message: "Request body must be valid JSON." }] });
  }

  if (payload.source !== "primelot") {
    return jsonError(400, "VALIDATION_ERROR", "source must be primelot.", { details: [{ field: "source", message: "source must be primelot." }] });
  }

  const sellerId = normalizePrimeLotSellerUserId(payload.primeLotSellerUserId);
  const sellerEmail = normalizePrimeLotEmail(payload.primeLotSellerEmail);
  if (!sellerId && !sellerEmail) {
    return jsonError(400, "VALIDATION_ERROR", "PrimeLot seller id or email is required.", { details: [{ field: "primeLotSellerUserId", message: "primeLotSellerUserId or primeLotSellerEmail is required." }] });
  }

  let supabase: ReturnType<typeof createServerSupabaseClient>;
  try {
    supabase = createServerSupabaseClient();
  } catch {
    return jsonError(500, "CONNECTION_STATUS_FAILED", "Could not check Wicked Card Tracker connection status.");
  }

  try {
    if (sellerId) {
      const idMatch = resolveRows(await findActiveConnections(supabase, "primelot_seller_user_id", sellerId));
      if (idMatch) return idMatch;
    }

    if (sellerEmail) {
      const emailMatch = resolveRows(await findActiveConnections(supabase, "primelot_seller_email", sellerEmail));
      if (emailMatch) return emailMatch;
    }

    return inactiveResponse();
  } catch (error) {
    console.error("PrimeLot connection-status failed", error);
    return jsonError(500, "CONNECTION_STATUS_FAILED", "Could not check Wicked Card Tracker connection status.");
  }
}
