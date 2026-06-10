export type PrimeLotListingType = "single_card" | "sealed_product" | "lot";

type PrimeLotImages = {
  frontUrl?: unknown;
  backUrl?: unknown;
  additionalUrls?: unknown;
};

export type PrimeLotImportListing = {
  primeLotListingId?: unknown;
  listingType?: unknown;
  primeLotStatus?: unknown;
  listingUrl?: unknown;
  title?: unknown;
  cardType?: unknown;
  category?: unknown;
  productType?: unknown;
  brand?: unknown;
  lotSize?: unknown;
  contents?: unknown;
  year?: unknown;
  setName?: unknown;
  cardNumber?: unknown;
  quantity?: unknown;
  price?: unknown;
  lowestAcceptablePrice?: unknown;
  buyerShipping?: unknown;
  purchasePrice?: unknown;
  purchaseDate?: unknown;
  gradingCompany?: unknown;
  [key: string]: unknown;
  grade?: unknown;
  condition?: unknown;
  images?: PrimeLotImages;
  description?: unknown;
  notes?: unknown;
};

export type PrimeLotImportPayload = {
  source?: unknown;
  eventId?: unknown;
  primeLotSellerUserId?: unknown;
  primeLotSellerEmail?: unknown;
  importMode?: unknown;
  listings?: unknown;
};

export type ValidationIssue = {
  index?: number;
  primeLotListingId?: string;
  field: string;
  message: string;
};

export type WctCardInsert = {
  user_id: string;
  workspace_id?: string | null;
  name: string;
  category: string;
  year: string;
  set_name: string;
  card_number: string;
  quantity: number;
  status: "Not Listed";
  listed_platform: string;
  listing_url: string;
  asking_price: number;
  lowest_acceptable_price: number;
  outbound_shipping: number;
  grading_company: string;
  grade: string;
  listed_date: null;
  front_photo_url: string;
  back_photo_url: string;
  purchase_date: string | null;
  purchase_price: number;
  sale_date: null;
  sale_platform: string;
  sold_price: number;
  notes: string;
  created_by: string;
  updated_by: string;
  source_platform?: "primelot";
  source_id?: string;
  source_url?: string;
  source_listing_type?: PrimeLotListingType;
};

export type NormalizedPrimeLotListing = {
  primeLotListingId: string;
  listingType: PrimeLotListingType;
  sourceUrl: string;
  row: WctCardInsert;
};

const allowedListingTypes = new Set(["single_card", "sealed_product", "lot"]);
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const numberFromMoney = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)/)?.[1];
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
};
const numeric = numberFromMoney;
const integer = (value: unknown, fallback = 1) => Math.max(1, Math.floor(Number(value) || fallback));
const dateTextOrNull = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(text(value)) ? text(value) : null;
const firstText = (...values: unknown[]) => values.map(text).find(Boolean) || "";
const firstNumber = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = numeric(value);
    if (parsed > 0) return parsed;
  }
  return 0;
};
const aliasKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const valueFromAliases = (listing: PrimeLotImportListing, aliases: string[]) => {
  const normalizedAliases = new Set(aliases.map(aliasKey));
  const seen = new Set<unknown>();
  const scan = (source: unknown, depth = 0): unknown => {
    if (!source || typeof source !== "object" || seen.has(source) || depth > 3) return undefined;
    seen.add(source);
    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      if (normalizedAliases.has(aliasKey(key)) && value !== undefined && value !== null && value !== "") return value;
    }
    for (const value of Object.values(source as Record<string, unknown>)) {
      const found = scan(value, depth + 1);
      if (found !== undefined && found !== null && found !== "") return found;
    }
    return undefined;
  };
  return scan(listing);
};

export const normalizePrimeLotEmail = (value: unknown) => text(value).toLowerCase();
export const normalizePrimeLotSellerUserId = (value: unknown) => text(value);

const validHttpUrl = (value: unknown) => {
  const candidate = text(value);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
};

const titleCaseCategory = (value: string) => value
  .replace(/[_-]+/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .split(" ")
  .map((word) => word ? `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}` : "")
  .join(" ");

const friendlyCategory = (value: unknown) => {
  const category = text(value);
  const normalized = category.toLowerCase().replace(/[\s-]+/g, "_");
  if (!category) return "";
  if (normalized === "one_piece" || normalized === "onepiece") return "One Piece";
  if (normalized === "pokemon" || normalized === "pokémon") return "Pokemon";
  if (normalized === "mtg" || normalized === "magic_the_gathering") return "MTG";
  if (normalized === "tcg") return "TCG";
  if (normalized === "sealed_product") return "Sealed Product";
  return titleCaseCategory(category);
};

const categoryForListing = (listing: PrimeLotImportListing, listingType: PrimeLotListingType) => {
  const category = friendlyCategory(listing.category);
  if (listingType === "sealed_product") return category || "Sealed Product";
  if (listingType === "lot") return category || "Lot";
  return category || friendlyCategory(listing.cardType) || "Sports";
};

const purchasePriceAliases = [
  "purchasePrice",
  "purchase_price",
  "originalPurchasePrice",
  "original_purchase_price",
  "pricePaid",
  "price_paid",
  "paidPrice",
  "paid_price",
  "amountPaid",
  "amount_paid",
  "costBasis",
  "cost_basis",
  "inventoryCost",
  "inventory_cost",
  "buyPrice",
  "buy_price",
  "purchaseCost",
  "purchase_cost",
  "wctPurchasePrice",
  "wct_purchase_price",
  "wctCost",
  "wct_cost",
  "unitCost",
  "unit_cost",
  "costEach",
  "cost_each",
  "totalCost",
  "total_cost",
  "purchaseCostTotal",
  "purchase_cost_total",
  "totalPurchasePrice",
  "total_purchase_price",
  "cardCost",
  "card_cost",
  "originalCost",
  "original_cost",
  "acquisitionCost",
  "acquisition_cost",
  "cost",
];

const purchasePriceFromText = (value: unknown) => {
  const body = text(value);
  if (!body) return 0;
  const patterns = [
    /(?:wct\s*purchase\s*price|purchase\s*price|purchase\s*cost|price\s*paid|paid\s*price|amount\s*paid|cost\s*basis|inventory\s*cost|card\s*cost|original\s*cost|acquisition\s*cost|buy\s*price|unit\s*cost|cost\s*each|total\s*cost)\s*[:=\-]?\s*\$?\s*([\d,]+(?:\.\d+)?)/i,
    /\$?\s*([\d,]+(?:\.\d+)?)\s*(?:wct\s*purchase\s*price|purchase\s*price|purchase\s*cost|price\s*paid|paid\s*price|amount\s*paid|cost\s*basis|inventory\s*cost|card\s*cost|original\s*cost|acquisition\s*cost|buy\s*price|unit\s*cost|cost\s*each|total\s*cost)/i,
  ];
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match?.[1]) return numberFromMoney(match[1]);
  }
  return 0;
};

export const purchasePriceForListing = (listing: PrimeLotImportListing) => {
  const direct = numeric(valueFromAliases(listing, purchasePriceAliases));
  if (direct > 0) return direct;

  const seen = new Set<unknown>();
  const scanTextFields = (source: unknown, depth = 0): number => {
    if (!source || seen.has(source) || depth > 3) return 0;
    if (typeof source === "string") return purchasePriceFromText(source);
    if (typeof source !== "object") return 0;
    seen.add(source);
    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      const normalizedKey = aliasKey(key);
      const shouldScanString = typeof value === "string" && (normalizedKey.includes("description") || normalizedKey.includes("note") || normalizedKey.includes("metadata") || normalizedKey.includes("detail"));
      const found = shouldScanString ? purchasePriceFromText(value) : scanTextFields(value, depth + 1);
      if (found > 0) return found;
    }
    return 0;
  };

  return scanTextFields(listing);
};

export const primeLotPurchasePriceFromAny = (value: unknown) => purchasePriceForListing((value || {}) as PrimeLotImportListing);

const metadataLines = (listing: PrimeLotImportListing, listingType: PrimeLotListingType, importedAt: string) => {
  const sourceUrl = validHttpUrl(listing.listingUrl);
  const lines = [
    "Source: PrimeLot",
    `PrimeLot Listing ID: ${text(listing.primeLotListingId)}`,
    `PrimeLot Listing URL: ${sourceUrl}`,
    `PrimeLot Listing Type: ${listingType}`,
    `PrimeLot Status: ${text(listing.primeLotStatus) || "unknown"}`,
    `PrimeLot Imported At: ${importedAt}`,
  ];

  const productType = text(listing.productType);
  const brand = text(listing.brand || listing.cardType);
  const lotSize = text(listing.lotSize);
  const condition = text(listing.condition);
  const description = text(listing.description);
  const note = text(listing.notes);

  if (listingType === "sealed_product" && productType) lines.push(`Product Type: ${productType}`);
  if (listingType === "sealed_product" && brand) lines.push(`Brand/Card Type: ${brand}`);
  if (listingType === "lot" && lotSize) lines.push(`Lot Size: ${lotSize}`);
  if (listingType === "lot" && Array.isArray(listing.contents)) lines.push(`Lot Contents: ${JSON.stringify(listing.contents).slice(0, 1500)}`);
  if (condition) lines.push(`Condition: ${condition}`);
  if (description) lines.push(`PrimeLot Description: ${description}`);
  if (note) lines.push(`PrimeLot Notes: ${note}`);

  return lines.join("\n");
};

export function validatePrimeLotImportPayload(payload: PrimeLotImportPayload): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (payload.source !== "primelot") issues.push({ field: "source", message: "source must be primelot." });
  if (!text(payload.eventId)) issues.push({ field: "eventId", message: "eventId is required." });
  if (!normalizePrimeLotSellerUserId(payload.primeLotSellerUserId) && !normalizePrimeLotEmail(payload.primeLotSellerEmail)) {
    issues.push({ field: "primeLotSellerUserId", message: "primeLotSellerUserId or primeLotSellerEmail is required." });
  }
  if (payload.importMode && payload.importMode !== "not_listed") {
    issues.push({ field: "importMode", message: "importMode must be not_listed." });
  }
  if (!Array.isArray(payload.listings) || payload.listings.length === 0) {
    issues.push({ field: "listings", message: "listings must be a non-empty array." });
    return issues;
  }
  payload.listings.forEach((item, index) => {
    const listing = item as PrimeLotImportListing;
    const id = text(listing.primeLotListingId);
    const listingType = text(listing.listingType);
    if (!id) issues.push({ index, field: "primeLotListingId", message: "primeLotListingId is required." });
    if (!allowedListingTypes.has(listingType)) issues.push({ index, primeLotListingId: id, field: "listingType", message: "listingType must be single_card, sealed_product, or lot." });
    if (!text(listing.title)) issues.push({ index, primeLotListingId: id, field: "title", message: "title is required." });
    const frontUrl = text(listing.images?.frontUrl);
    const backUrl = text(listing.images?.backUrl);
    if (frontUrl && !validHttpUrl(frontUrl)) issues.push({ index, primeLotListingId: id, field: "images.frontUrl", message: "images.frontUrl must be a valid http(s) URL." });
    if (backUrl && !validHttpUrl(backUrl)) issues.push({ index, primeLotListingId: id, field: "images.backUrl", message: "images.backUrl must be a valid http(s) URL." });
  });
  return issues;
}

export function primeLotListingsToWctRows(
  payload: PrimeLotImportPayload,
  userId: string,
  workspaceId: string | null,
  importedAt = new Date().toISOString(),
): NormalizedPrimeLotListing[] {
  if (!Array.isArray(payload.listings)) return [];

  return payload.listings.map((item) => {
    const listing = item as PrimeLotImportListing;
    const listingType = text(listing.listingType) as PrimeLotListingType;
    const primeLotListingId = text(listing.primeLotListingId);
    const sourceUrl = validHttpUrl(firstText(listing.listingUrl, listing.url, listing.publicUrl, listing.public_url));
    const title = firstText(listing.title, listing.card_name, listing.cardName, listing.name, listing.product_name, listing.productName);
    const category = categoryForListing({
      ...listing,
      category: firstText(listing.category, listing.card_type, listing.cardType, listing.product_type, listing.productType),
      cardType: firstText(listing.cardType, listing.card_type),
    }, listingType);
    const now = importedAt;
    const row: WctCardInsert = {
      user_id: userId,
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
      name: title,
      category,
      year: text(listing.year),
      set_name: text(listing.setName),
      card_number: listingType === "single_card" ? text(listing.cardNumber) : "",
      quantity: integer(listing.quantity),
      status: "Not Listed",
      listed_platform: "",
      listing_url: "",
      asking_price: firstNumber(listing.price, listing.askingPrice, listing.asking_price, listing.listPrice, listing.list_price),
      lowest_acceptable_price: firstNumber(listing.lowestAcceptablePrice, listing.lowest_acceptable_price, listing.minimumSalePrice, listing.minimum_sale_price),
      outbound_shipping: firstNumber(listing.buyerShipping, listing.buyer_shipping, listing.shipping_cost, listing.shippingCost, listing.shippingCharge, listing.shipping_charge),
      grading_company: listingType === "single_card" ? text(listing.gradingCompany) : "",
      grade: listingType === "single_card" ? text(listing.grade) : "",
      listed_date: null,
      front_photo_url: validHttpUrl(firstText(listing.images?.frontUrl, listing.image_url_front, listing.imageUrlFront, listing.frontPhotoUrl, listing.front_photo_url)),
      back_photo_url: validHttpUrl(firstText(listing.images?.backUrl, listing.image_url_back, listing.imageUrlBack, listing.backPhotoUrl, listing.back_photo_url)),
      purchase_date: dateTextOrNull(listing.purchaseDate),
      purchase_price: purchasePriceForListing(listing),
      sale_date: null,
      sale_platform: "",
      sold_price: 0,
      notes: metadataLines(listing, listingType, now),
      created_by: userId,
      updated_by: userId,
      source_platform: "primelot",
      source_id: primeLotListingId,
      source_url: sourceUrl,
      source_listing_type: listingType,
    };

    return { primeLotListingId, listingType, sourceUrl, row };
  });
}

export function rowWithoutSourceTracking(row: WctCardInsert) {
  const { source_platform: _sourcePlatform, source_id: _sourceId, source_url: _sourceUrl, source_listing_type: _sourceListingType, ...fallbackRow } = row;
  return fallbackRow;
}
