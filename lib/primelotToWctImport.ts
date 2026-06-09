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
const numeric = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const integer = (value: unknown, fallback = 1) => Math.max(1, Math.floor(Number(value) || fallback));
const dateTextOrNull = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(text(value)) ? text(value) : null;

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

const categoryForListing = (listing: PrimeLotImportListing, listingType: PrimeLotListingType) => {
  const category = text(listing.category);
  if (listingType === "sealed_product") return category || "Sealed Product";
  if (listingType === "lot") return category || "Lot";
  return category || text(listing.cardType) || "Sports";
};

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
    const sourceUrl = validHttpUrl(listing.listingUrl);
    const title = text(listing.title);
    const category = categoryForListing(listing, listingType);
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
      asking_price: numeric(listing.price),
      lowest_acceptable_price: numeric(listing.lowestAcceptablePrice),
      outbound_shipping: numeric(listing.buyerShipping),
      grading_company: listingType === "single_card" ? text(listing.gradingCompany) : "",
      grade: listingType === "single_card" ? text(listing.grade) : "",
      listed_date: null,
      front_photo_url: validHttpUrl(listing.images?.frontUrl),
      back_photo_url: validHttpUrl(listing.images?.backUrl),
      purchase_date: dateTextOrNull(listing.purchaseDate),
      purchase_price: numeric(listing.purchasePrice),
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
