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

const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

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
  const primeLotSellerUserId = process.env.PRIMELOT_SELLER_USER_ID;
  const primeLotSiteUrl = (process.env.PRIMELOT_SITE_URL || "https://primelot.cards").replace(/\/$/, "");
  const primeLotPostStatus = process.env.PRIMELOT_POST_STATUS || "active";

  if (!cardTrackerSupabaseUrl || !cardTrackerSupabaseAnonKey) {
    return jsonError("Wicked Card Tracker Supabase auth is not configured.", 503);
  }
  if (!primeLotSupabaseUrl || !primeLotServiceRoleKey || !primeLotSellerUserId) {
    return jsonError("PrimeLot posting is not configured yet. Add PRIMELOT_SUPABASE_URL, PRIMELOT_SUPABASE_SERVICE_ROLE_KEY, and PRIMELOT_SELLER_USER_ID in Vercel.", 503);
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7) : "";
  if (!token) return jsonError("Sign in before posting to PrimeLot.", 401);

  const cardTrackerSupabase = createClient(cardTrackerSupabaseUrl, cardTrackerSupabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await cardTrackerSupabase.auth.getUser(token);
  if (authError || !authData.user) return jsonError("Your Wicked Card Tracker session could not be verified.", 401);

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

  const rows = cards.map((card) => ({
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
    source_platform: "wickedcardtracker",
    source_id: card.id,
  }));

  const { data, error } = await primeLotSupabase
    .from("single_cards")
    .insert(rows)
    .select("id, source_id, status");

  if (error) return jsonError(`PrimeLot rejected the listings: ${error.message}`, 502);

  const createdListings: CreatedListing[] = (data || []).map((row: { id: string; source_id: string; status: string }) => ({
    cardTrackerId: row.source_id,
    primeLotListingId: row.id,
    url: `${primeLotSiteUrl}/single-cards/${row.id}`,
    status: row.status,
  }));

  return NextResponse.json({ createdListings });
}
