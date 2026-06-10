import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type PrimeLotListingType = "single_card" | "sealed_product" | "lot";

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
  shippingCharge?: number;
  gradingCompany?: string;
  grade?: string;
  listedDate?: string;
  frontPhotoUrl?: string;
  backPhotoUrl?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  soldPrice?: number;
  listingType?: PrimeLotListingType;
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

type SellerMembershipProbe = {
  table: string;
  userColumn: string;
  select: string;
  statusKeys: string[];
  planKeys: string[];
  endKeys: string[];
};

const jsonError = (message: string, status = 400, code?: string) => NextResponse.json({ error: message, code }, { status });
const missingConnectionTable = (message = "") => /relation .*primelot_connections.* does not exist|schema cache.*primelot_connections|Could not find the table/i.test(message);
const sourceTrackingColumnError = (message = "") => /source_id|source_platform/i.test(message) && /schema cache|column|Could not find/i.test(message);
const shippingColumnError = (message = "") => /shipping_cost/i.test(message) && /schema cache|column|Could not find/i.test(message);
const purchaseCostColumnError = (message = "") => /purchase_price|purchase_cost|original_purchase_price|cost_basis/i.test(message) && /schema cache|column|Could not find/i.test(message);
const photoColumnError = (message = "") => /image_url_front|image_url_back/i.test(message) && /schema cache|column|Could not find/i.test(message);

const normalizePrimeLotImageUrl = (value?: string) => {
  const trimmed = value?.trim() || "";
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? trimmed : "";
  } catch {
    return "";
  }
};

const allowedListingTypes = new Set<PrimeLotListingType>(["single_card", "sealed_product", "lot"]);
const primeLotListingTargets: Record<PrimeLotListingType, { table: string; path: string }> = {
  single_card: { table: "single_cards", path: "single-cards" },
  sealed_product: { table: "sealed_products", path: "sealed-products" },
  lot: { table: "lots", path: "lots" },
};
const listingTypeForCard = (card: CardPayload): PrimeLotListingType | null => {
  const value = String(card.listingType || "");
  if (!allowedListingTypes.has(value as PrimeLotListingType)) return null;
  return value as PrimeLotListingType;
};

const cardTypeForCategory = (category?: string) => {
  const value = (category || "").toLowerCase();
  if (value.includes("pokemon") || value.includes("pokémon")) return "pokemon";
  if (value.includes("one piece")) return "one_piece";
  return "sports";
};

const cleanGrade = (value?: string) => (value || "").trim().replace(/^grade:\s*/i, "");
const sellerMembershipActiveStatuses = new Set(["active", "trialing"]);
const sellerMembershipPlanTokens = ["seller", "buyer_seller", ...(process.env.PRIMELOT_SELLER_PLAN_TOKENS || "").split(",").map((token) => token.trim().toLowerCase()).filter(Boolean)];
const sellerMembershipStatusIsActive = (value: unknown) => sellerMembershipActiveStatuses.has(String(value || "").toLowerCase());
const sellerMembershipPlanIsSeller = (value: unknown) => sellerMembershipPlanTokens.some((token) => String(value || "").toLowerCase().includes(token));
const sellerMembershipDateIsCurrent = (value: unknown) => {
  if (!value) return true;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) || date.getTime() >= Date.now();
};
const rowShowsActiveSellerMembership = (row: Record<string, unknown>, probe: SellerMembershipProbe) => {
  const statusActive = probe.statusKeys.some((key) => sellerMembershipStatusIsActive(row[key]));
  const planIsSeller = !probe.planKeys.length || probe.planKeys.some((key) => sellerMembershipPlanIsSeller(row[key]));
  const dateIsCurrent = probe.endKeys.every((key) => sellerMembershipDateIsCurrent(row[key]));
  return statusActive && planIsSeller && dateIsCurrent;
};
const membershipProbeFromEnv = (): SellerMembershipProbe | null => {
  const table = process.env.PRIMELOT_SELLER_MEMBERSHIP_TABLE;
  if (!table) return null;
  const statusColumn = process.env.PRIMELOT_SELLER_MEMBERSHIP_STATUS_COLUMN || "status";
  const planColumn = process.env.PRIMELOT_SELLER_MEMBERSHIP_PLAN_COLUMN || "plan";
  const endColumn = process.env.PRIMELOT_SELLER_MEMBERSHIP_END_COLUMN || "current_period_end";
  return {
    table,
    userColumn: process.env.PRIMELOT_SELLER_MEMBERSHIP_USER_COLUMN || "user_id",
    select: "*",
    statusKeys: [statusColumn, "status", "subscription_status", "membership_status"],
    planKeys: planColumn ? [planColumn, "plan", "plan_id", "price_id", "membership_plan", "subscription_plan"] : [],
    endKeys: endColumn ? [endColumn] : [],
  };
};
const defaultMembershipProbes: SellerMembershipProbe[] = [
  { table: "subscriptions", userColumn: "user_id", select: "*", statusKeys: ["status", "subscription_status"], planKeys: ["plan", "plan_id", "price_id", "membership_plan", "subscription_plan"], endKeys: ["current_period_end"] },
  { table: "stripe_subscriptions", userColumn: "user_id", select: "*", statusKeys: ["status", "subscription_status"], planKeys: ["plan", "plan_id", "price_id", "membership_plan", "subscription_plan"], endKeys: ["current_period_end"] },
  { table: "memberships", userColumn: "user_id", select: "*", statusKeys: ["status", "membership_status"], planKeys: ["plan", "plan_id", "price_id", "membership_plan"], endKeys: ["current_period_end", "expires_at", "ends_at"] },
  { table: "profiles", userColumn: "id", select: "*", statusKeys: ["membership_status", "subscription_status"], planKeys: ["membership_plan", "plan", "plan_id", "price_id", "subscription_plan"], endKeys: [] },
];
const hasActiveSellerMembership = async (primeLotSupabase: any, primeLotSellerUserId: string) => {
  const probes = [membershipProbeFromEnv(), ...defaultMembershipProbes].filter((probe): probe is SellerMembershipProbe => Boolean(probe));
  for (const probe of probes) {
    const { data, error } = await primeLotSupabase
      .from(probe.table)
      .select(probe.select)
      .eq(probe.userColumn, primeLotSellerUserId)
      .limit(10);
    if (error) continue;
    if ((data || []).some((row: Record<string, unknown>) => rowShowsActiveSellerMembership(row, probe))) return true;
  }
  return false;
};
const gradeParts = (value?: string) => {
  const clean = cleanGrade(value);
  const match = clean.match(/^(PSA|BGS|SGC|CGC|TAG)\s+(.+)$/i);
  return match ? { company: match[1].toUpperCase(), grade: match[2].trim() } : { company: "", grade: clean };
};
const noteValue = (notes: string | undefined, label: string) => (notes || "").split("\n").find((line) => line.toLowerCase().startsWith(`${label.toLowerCase()}:`))?.replace(new RegExp(`^${label}:\\s*`, "i"), "").trim() || "";
const gradingDetailsForCard = (card: CardPayload) => {
  const parsed = gradeParts(card.grade || noteValue(card.notes, "Grade"));
  const company = (card.gradingCompany || noteValue(card.notes, "Grader") || parsed.company).trim();
  return { company, grade: parsed.grade };
};

const descriptionForCard = (card: CardPayload) => [
  card.setName ? `Set: ${card.setName}` : "",
  card.cardNumber ? `Card Number: ${card.cardNumber}` : "",
  card.category ? `Category: ${card.category}` : "",
  card.status ? `WickedCardTracker Status: ${card.status}` : "",
  card.listedPlatform ? `Previous Listed Platform: ${card.listedPlatform}` : "",
  card.lowestAcceptablePrice ? `Minimum Sale Price: ${card.lowestAcceptablePrice}` : "",
  Number(card.shippingCharge || 0) >= 0 ? `Buyer Shipping Charge: ${Number(card.shippingCharge || 0).toFixed(2)}` : "",
  gradingDetailsForCard(card).company ? `Grading Company: ${gradingDetailsForCard(card).company}` : "",
  gradingDetailsForCard(card).grade ? `Grade: ${gradingDetailsForCard(card).grade}` : "",
  card.purchaseDate ? `Purchase Date: ${card.purchaseDate}` : "",
  Number.isFinite(card.purchasePrice) ? `Purchase Price: ${card.purchasePrice}` : "",
  Number.isFinite(card.purchasePrice) ? `WCT Purchase Price: ${card.purchasePrice}` : "",
  card.notes?.trim() ? `Notes: ${card.notes.trim()}` : "",
].filter(Boolean).join("\n");

type PrimeLotImportRow = { card: CardPayload; listingType: PrimeLotListingType; row: Record<string, unknown>; formData: FormData | null };

export async function POST(request: NextRequest) {
  const cardTrackerSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cardTrackerSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const primeLotSupabaseUrl = process.env.PRIMELOT_SUPABASE_URL;
  const primeLotServiceRoleKey = process.env.PRIMELOT_SUPABASE_SERVICE_ROLE_KEY;
  const primeLotSiteUrl = (process.env.PRIMELOT_SITE_URL || "https://primelot.cards").replace(/\/$/, "");

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

  const workspaceId = null;

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
  if (invalidCard) return jsonError("Every PrimeLot import needs a card name and asking price.");
  const cardMissingListingType = cards.find((card) => {
    const listingType = listingTypeForCard(card);
    if (!listingType) return true;
    return false;
  });
  if (cardMissingListingType) return jsonError("Choose Single Card, Sealed Product, or Lot before importing to PrimeLot.");
  const cardWithInvalidPhoto = cards.find((card) => (
    (card.frontPhotoUrl?.trim() && !normalizePrimeLotImageUrl(card.frontPhotoUrl))
    || (card.backPhotoUrl?.trim() && !normalizePrimeLotImageUrl(card.backPhotoUrl))
  ));
  if (cardWithInvalidPhoto) return jsonError(`PrimeLot needs public http/https photo URLs. Re-upload the front/back photos for ${cardWithInvalidPhoto.name || "that card"} before posting.`, 400, "PRIMELOT_INVALID_PHOTO_URL");
  const hasRequestedShipping = cards.some((card) => Number(card.shippingCharge || 0) > 0);
  const hasRequestedPhotos = cards.some((card) => Boolean(normalizePrimeLotImageUrl(card.frontPhotoUrl) || normalizePrimeLotImageUrl(card.backPhotoUrl)));

  const primeLotSupabase = createClient(primeLotSupabaseUrl, primeLotServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const primeLotSellerMembershipActive = await hasActiveSellerMembership(primeLotSupabase, primeLotSellerUserId);
  if (!primeLotSellerMembershipActive) {
    return jsonError("Start a PrimeLot Seller membership to import and publish your listings.", 403, "PRIMELOT_SELLER_MEMBERSHIP_REQUIRED");
  }
  // Temporary fallback while PrimeLot's browser-session-protected WCT import endpoint
  // is replaced with a server-to-server multipart endpoint. Do not change this
  // fallback to active/live: PrimeLot should own live publishing, duplicate checks,
  // and final membership rules when the import API is available.
  const primeLotPostStatus = "draft";

  const primeLotImportFormDataForCard = (card: CardPayload, row: Record<string, unknown>) => {
    const listingType = listingTypeForCard(card);
    if (!listingType) return null;
    const formData = new FormData();
    formData.append("listingType", listingType);
    formData.append("cardType", cardTypeForCategory(card.category));
    formData.append("file", new Blob([JSON.stringify({ listings: [row] })], { type: "application/json" }), `wicked-card-tracker-${card.id}.json`);
    return formData;
  };

  const baseRows = cards.map((card): PrimeLotImportRow | null => {
    const grading = gradingDetailsForCard(card);
    const listingType = listingTypeForCard(card);
    if (!listingType) return null;
    const row = {
      user_id: primeLotSellerUserId,
      card_type: cardTypeForCategory(card.category),
      card_name: card.name.trim(),
      description: descriptionForCard(card) || null,
      year: card.year?.trim() || null,
      player: null,
      is_graded: Boolean(grading.company || grading.grade),
      condition: "near_mint",
      grading_company: grading.company || null,
      grade: grading.grade || null,
      price: Number(card.askingPrice || 0),
      image_url_front: normalizePrimeLotImageUrl(card.frontPhotoUrl),
      image_url_back: normalizePrimeLotImageUrl(card.backPhotoUrl),
      status: primeLotPostStatus,
      commission_rate: 0,
      transaction_id: null,
      wishlist_id: null,
      is_wishlist_offer: false,
      quantity: Math.max(1, Math.floor(Number(card.quantity) || 1)),
      quantity_sold: 0,
      purchase_price: Number(card.purchasePrice || 0),
      purchase_cost: Number(card.purchasePrice || 0),
      original_purchase_price: Number(card.purchasePrice || 0),
      original_price: Number(card.purchasePrice || 0),
      cost_basis: Number(card.purchasePrice || 0),
    };
    return { card, listingType, row, formData: primeLotImportFormDataForCard(card, row) };
  }).filter((item): item is PrimeLotImportRow => Boolean(item));
  const rowsWithShipping: PrimeLotImportRow[] = baseRows.map((item) => ({
    ...item,
    row: {
      ...item.row,
      shipping_cost: Number(item.card.shippingCharge || 0),
    },
  }));
  const rowsWithSourceTracking: PrimeLotImportRow[] = rowsWithShipping.map((item) => ({
    ...item,
    row: {
      ...item.row,
      source_platform: "wickedcardtracker",
      source_id: item.card.id,
    },
  }));

  const createdListings: CreatedListing[] = [];
  for (const listingType of allowedListingTypes) {
    const target = primeLotListingTargets[listingType];
    let group = rowsWithSourceTracking.filter((item) => item.listingType === listingType);
    if (!group.length) continue;

    let insertedUsingSourceTracking = true;
    let insertResult = await primeLotSupabase
      .from(target.table)
      .insert(group.map((item) => item.row))
      .select("id, source_id, status");

    if (insertResult.error && photoColumnError(insertResult.error.message)) {
      if (hasRequestedPhotos) return jsonError("PrimeLot could not save the front/back photos because its image_url_front/image_url_back fields are missing. The listings were not posted without your photos.", 502, "PRIMELOT_PHOTOS_NOT_CONFIGURED");
      group = group.map((item) => {
        const { image_url_front: _frontPhoto, image_url_back: _backPhoto, ...row } = item.row;
        return { ...item, row };
      });
      insertResult = await primeLotSupabase
        .from(target.table)
        .insert(group.map((item) => item.row))
        .select("id, source_id, status");
    }

    if (insertResult.error && shippingColumnError(insertResult.error.message)) {
      if (hasRequestedShipping) return jsonError("PrimeLot could not save buyer shipping because its shipping_cost field is missing. The listings were not posted without your shipping charges.", 502, "PRIMELOT_SHIPPING_NOT_CONFIGURED");
      group = group.map((item) => {
        const { shipping_cost: _shippingCost, ...row } = item.row;
        return { ...item, row };
      });
      insertResult = await primeLotSupabase
        .from(target.table)
        .insert(group.map((item) => item.row))
        .select("id, source_id, status");
    }

    while (insertResult.error && purchaseCostColumnError(insertResult.error.message)) {
      const missingColumn = insertResult.error.message.match(/Could not find the '([^']+)' column/i)?.[1] || "";
      if (!missingColumn || !group.some((item) => missingColumn in item.row)) break;
      group = group.map((item) => {
        const { [missingColumn]: _missingPurchaseColumn, ...row } = item.row;
        return { ...item, row };
      });
      insertResult = await primeLotSupabase
        .from(target.table)
        .insert(group.map((item) => item.row))
        .select("id, source_id, status");
    }

    if (insertResult.error && sourceTrackingColumnError(insertResult.error.message)) {
      insertedUsingSourceTracking = false;
      group = group.map((item) => {
        const { source_id: _sourceId, source_platform: _sourcePlatform, ...row } = item.row;
        return { ...item, row };
      });
      insertResult = await primeLotSupabase
        .from(target.table)
        .insert(group.map((item) => item.row))
        .select("id, status");
    }

    if (insertResult.error) return jsonError(`PrimeLot rejected the ${target.table} imports: ${insertResult.error.message}`, 502);

    createdListings.push(...(insertResult.data || []).map((row: { id: string; source_id?: string; status: string }, index: number) => ({
      cardTrackerId: insertedUsingSourceTracking ? row.source_id || group[index]?.card.id || "" : group[index]?.card.id || "",
      primeLotListingId: row.id,
      url: `${primeLotSiteUrl}/${target.path}/${row.id}`,
      status: row.status,
    })).filter((listing: CreatedListing) => Boolean(listing.cardTrackerId)));
  }

  return NextResponse.json({ createdListings });
}
