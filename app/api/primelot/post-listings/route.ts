import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type CardPayload = {
  id: string;
  name: string;
  category?: string;
  year?: string;
  setName?: string;
  cardNumber?: string;
  quantity?: number;
  status?: string;
  listedPlatform?: string;
  askingPrice?: number;
  lowestAcceptablePrice?: number;
  listedDate?: string;
  frontPhotoUrl?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  soldPrice?: number;
  notes?: string;
};

type CreatedListing = {
  cardTrackerId: string;
  primeLotListingId: string;
  url: string;
  status: string;
};

type PrimeLotConnection = {
  primelot_seller_user_id: string | null;
  primelot_seller_email: string | null;
  primelot_store_slug: string | null;
  status: string | null;
};

const jsonError = (message: string, status = 400, code?: string) => NextResponse.json({ error: message, code }, { status });
const missingConnectionTable = (message = "") => /relation .*primelot_connections.* does not exist|schema cache.*primelot_connections|Could not find the table/i.test(message);
const sourceTrackingColumnError = (message = "") => /source_id|source_platform/i.test(message) && /schema cache|column|Could not find/i.test(message);

const cardTypeForCategory = (category?: string) => {
  const value = (category || "").toLowerCase();
  if (value.includes("pokemon") || value.includes("pokémon")) return "pokemon";
  if (value.includes("one piece")) return "one_piece";
  if (value.includes("magic") || value.includes("mtg")) return "mtg";
  if (value.includes("yugioh") || value.includes("yu-gi-oh")) return "yugioh";
  return "sports";
};

const descriptionForCard = (card: CardPayload) => [
  card.setName ? `Set: ${card.setName}` : "",
  card.cardNumber ? `Card Number: ${card.cardNumber}` : "",
  card.category ? `Category: ${card.category}` : "",
  card.status ? `WickedCardTracker Status: ${card.status}` : "",
  card.listedPlatform ? `Previous Listed Platform: ${card.listedPlatform}` : "",
  card.lowestAcceptablePrice ? `Minimum Sale Price: ${card.lowestAcceptablePrice}` : "",
  card.purchaseDate ? `Purchase Date: ${card.purchaseDate}` : "",
  Number.isFinite(card.purchasePrice) ? `Purchase Price: ${card.purchasePrice}` : "",
  card.notes?.trim() ? `Notes: ${card.notes.trim()}` : "",
].filter(Boolean).join("\n");

export async function POST(request: NextRequest) {
  const cardTrackerSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cardTrackerSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const primeLotSupabaseUrl = process.env.PRIMELOT_SUPABASE_URL;
  const primeLotServiceRoleKey = process.env.PRIMELOT_SUPABASE_SERVICE_ROLE_KEY;
  const primeLotSiteUrl = (process.env.PRIMELOT_SITE_URL || "https://primelot.cards").replace(/\/$/, "");
  const primeLotPostStatus = process.env.PRIMELOT_POST_STATUS || "active";

  if (!cardTrackerSupabaseUrl || !cardTrackerSupabaseAnonKey) {
    return jsonError("Wicked Card Tracker Supabase auth is not configured.", 503);
  }
  if (!primeLotSupabaseUrl || !primeLotServiceRoleKey) {
    return jsonError("PrimeLot posting is not configured yet. Add PRIMELOT_SUPABASE_URL and PRIMELOT_SUPABASE_SERVICE_ROLE_KEY in Vercel.", 503, "PRIMELOT_NOT_CONFIGURED");
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7) : "";
  if (!token) return jsonError("Sign in before posting to PrimeLot.", 401);

  const cardTrackerSupabase = createClient(cardTrackerSupabaseUrl, cardTrackerSupabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await cardTrackerSupabase.auth.getUser(token);
  if (authError || !authData.user) return jsonError("Your Wicked Card Tracker session could not be verified.", 401);

  const membershipResult = await cardTrackerSupabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", authData.user.id)
    .limit(1)
    .maybeSingle();
  const workspaceId = membershipResult.error ? null : membershipResult.data?.workspace_id ?? null;

  const connectionSelect = "primelot_seller_user_id,primelot_seller_email,primelot_store_slug,status";
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
      .eq("user_id", authData.user.id)
      .is("workspace_id", null)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
  }

  if (connectionResult.error) {
    if (missingConnectionTable(connectionResult.error.message)) {
      const fallbackSellerUserId = process.env.PRIMELOT_SELLER_USER_ID;
      if (!fallbackSellerUserId) return jsonError("Connect a PrimeLot seller account before posting. Run supabase-primelot-connections-migration.sql to enable the connection flow.", 409, "PRIMELOT_NOT_CONNECTED");
      connectionResult = { data: { primelot_seller_user_id: fallbackSellerUserId, primelot_seller_email: null, primelot_store_slug: null, status: "active" }, error: null };
    } else {
      return jsonError(`Could not check your PrimeLot connection: ${connectionResult.error.message}`, 500);
    }
  }

  const primeLotConnection = connectionResult.data as PrimeLotConnection | null;
  const primeLotSellerUserId = primeLotConnection?.primelot_seller_user_id || process.env.PRIMELOT_SELLER_USER_ID;
  if (!primeLotSellerUserId) return jsonError("Connect a PrimeLot seller account before posting.", 409, "PRIMELOT_NOT_CONNECTED");

  let body: { cards?: CardPayload[] };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON payload.");
  }

  const cards = Array.isArray(body.cards) ? body.cards : [];
  if (!cards.length) return jsonError("Select at least one card to post to PrimeLot.");
  if (cards.length > 50) return jsonError("Post 50 cards or fewer at a time.");

  const invalidCard = cards.find((card) => !card.id || !card.name?.trim() || Number(card.askingPrice || 0) <= 0);
  if (invalidCard) return jsonError("Every PrimeLot post needs a card name and asking price.");

  const primeLotSupabase = createClient(primeLotSupabaseUrl, primeLotServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const baseRows = cards.map((card) => ({
    user_id: primeLotSellerUserId,
    card_type: cardTypeForCategory(card.category),
    card_name: card.name.trim(),
    description: descriptionForCard(card) || null,
    year: card.year?.trim() || null,
    player: null,
    is_graded: false,
    condition: "near_mint",
    grading_company: null,
    grade: null,
    price: Number(card.askingPrice || 0),
    image_url_front: card.frontPhotoUrl?.trim() || null,
    image_url_back: null,
    status: primeLotPostStatus,
    commission_rate: 0,
    transaction_id: null,
    wishlist_id: null,
    is_wishlist_offer: false,
    quantity: Math.max(1, Math.floor(Number(card.quantity) || 1)),
    quantity_sold: 0,
  }));
  const rowsWithSourceTracking = baseRows.map((row, index) => ({
    ...row,
    source_platform: "wickedcardtracker",
    source_id: cards[index].id,
  }));

  let insertedUsingSourceTracking = true;
  let insertResult = await primeLotSupabase
    .from("single_cards")
    .insert(rowsWithSourceTracking)
    .select("id, source_id, status");

  if (insertResult.error && sourceTrackingColumnError(insertResult.error.message)) {
    insertedUsingSourceTracking = false;
    insertResult = await primeLotSupabase
      .from("single_cards")
      .insert(baseRows)
      .select("id, status");
  }

  if (insertResult.error) return jsonError(`PrimeLot rejected the listings: ${insertResult.error.message}`, 502);

  const createdListings: CreatedListing[] = (insertResult.data || []).map((row: { id: string; source_id?: string; status: string }, index: number) => ({
    cardTrackerId: insertedUsingSourceTracking ? row.source_id || cards[index]?.id || "" : cards[index]?.id || "",
    primeLotListingId: row.id,
    url: `${primeLotSiteUrl}/single-cards/${row.id}`,
    status: row.status,
  })).filter((listing) => Boolean(listing.cardTrackerId));

  return NextResponse.json({ createdListings });
}
