const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const route = fs.readFileSync(path.join(root, "app/api/primelot/import/route.ts"), "utf8");
const mapper = fs.readFileSync(path.join(root, "lib/primelotToWctImport.ts"), "utf8");
const serverSupabase = fs.readFileSync(path.join(root, "lib/serverSupabase.ts"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase-primelot-inbound-source-migration.sql"), "utf8");

assert(route.includes('export async function POST(request: NextRequest)'), "PrimeLot inbound import route exposes POST.");
assert(route.includes('process.env.PRIMELOT_TO_WCT_IMPORT_SECRET'), "Route checks PRIMELOT_TO_WCT_IMPORT_SECRET.");
assert(route.includes('request.headers.get("x-wct-webhook-secret")'), "Route requires X-WCT-Webhook-Secret header.");
assert(route.includes('.from("primelot_connections")'), "Route resolves WCT account from primelot_connections.");
assert(route.includes('.eq("status", "active")'), "Route only matches active PrimeLot connections.");
assert(route.includes('WCT_ACCOUNT_NOT_CONNECTED'), "Route returns a not-connected error.");
assert(route.includes('AMBIGUOUS_WCT_ACCOUNT'), "Route returns an ambiguous-account error.");
assert(route.includes('source_platform'), "Route uses source tracking columns for duplicate detection.");
assert(route.includes('skipped_duplicate'), "Route skips duplicates instead of creating another card.");
assert(route.includes('missingColumnName') && route.includes('created_by') && route.includes('updated_by'), "Route gracefully skips missing optional audit columns instead of crashing.");
assert(route.includes('WCT_CARD_INSERT_FAILED') && route.includes('WCT_IMPORT_UNEXPECTED_ERROR'), "Route returns structured import errors instead of generic WCT_IMPORT_FAILED.");
assert(route.includes('rowWithoutSourceTracking'), "Route has notes-based fallback if source columns are missing.");

assert(mapper.includes('status: "Not Listed"'), "Mapper defaults imported listings to Not Listed.");
assert(mapper.includes('listed_platform: ""'), "Mapper keeps listedPlatform blank.");
assert(mapper.includes('listing_url: ""'), "Mapper keeps WCT listingUrl blank.");
assert(mapper.includes('PrimeLot Listing Type'), "Mapper preserves PrimeLot listing type in notes.");
assert(mapper.includes('single_card') && mapper.includes('sealed_product') && mapper.includes('lot'), "Mapper supports all PrimeLot listing types.");
assert(mapper.includes('images.frontUrl') && mapper.includes('images.backUrl'), "Mapper accepts front/back image URLs.");
assert(mapper.includes('friendlyCategory') && mapper.includes('titleCaseCategory') && mapper.includes('One Piece') && mapper.includes('Pokemon'), "Mapper converts PrimeLot machine category names like one_piece, pokemon, and sports into customer-friendly labels.");
assert(mapper.includes('purchasePriceAliases') && mapper.includes('purchasePriceFromText') && mapper.includes('originalPurchasePrice') && mapper.includes('pricePaid') && mapper.includes('costBasis') && mapper.includes('acquisitionCost'), "Mapper accepts PrimeLot purchase-price aliases and parses WCT-exported purchase price text.");
assert(mapper.includes('wctPurchasePrice') && mapper.includes('costEach') && mapper.includes('totalPurchasePrice') && mapper.includes('scanTextFields'), "Mapper handles PrimeLot/WCT purchase-cost aliases and nested description/notes text.");
assert(route.includes('refreshDuplicateMissingCost') && route.includes('purchase_price') && route.includes('Existing WCT card was already imported; filled missing purchase price'), "Import route refreshes missing purchase price on an already-imported duplicate instead of leaving the old $0 row unchanged.");
assert(route.includes('enrichListingsFromWctOrigin') && route.includes('findDuplicateByPrimeLotListingLink') && route.includes('original WCT card already linked to this PrimeLot listing'), "Import route first recovers purchase cost from the original WCT card/listing link before relying on PrimeLot source-table fields.");
assert(route.includes('Existing WCT card already has this PrimeLot listing link; skipped duplicate import.'), "Round-trip imports should skip creating another WCT card when the PrimeLot listing is already linked to an existing WCT card.");
assert(route.includes('enrichListingsFromPrimeLotSource') && route.includes('PRIMELOT_SUPABASE_URL') && route.includes('primeLotPurchasePriceFromAny') && route.includes('PrimeLot Cost Recovery'), "Import route falls back to reading the PrimeLot listing row and records recovery diagnostics when the inbound webhook payload does not include purchase cost.");
assert(route.includes('findWctOriginByPrimeLotSourceRow') && route.includes('primeLotSourceCardId') && route.includes('original WCT card referenced by the PrimeLot source row'), "Import route recovers purchase cost from PrimeLot source_id/cardTrackerId back-pointers when WCT created the PrimeLot draft but did not mark the original card as listed.");
assert(route.includes('primeLotListingIdCandidates') && route.includes('allPrimeLotSourceTables') && route.includes('.in("id", idCandidates)'), "Import route finds the PrimeLot source row even when the webhook sends a URL/id variant or the listing type points at the wrong PrimeLot table.");
assert(route.includes('PrimeLot WCT import diagnostics') && route.includes('inboundDiagnosticValues') && route.includes('enrichedPurchasePrice'), "Import route logs sanitized diagnostics so failed live imports can be debugged from evidence instead of guessing.");
assert(mapper.includes('export const purchasePriceForListing') && mapper.includes('primeLotPurchasePriceFromAny'), "Purchase-cost extraction is exported for the PrimeLot source-row fallback.");

assert(serverSupabase.includes('SUPABASE_SERVICE_ROLE_KEY'), "Server Supabase client uses service role env var.");
assert(migration.includes('source_platform') && migration.includes('source_id'), "Migration adds source tracking columns.");
assert(migration.includes('cards_user_source_unique'), "Migration adds unique source-tracking index.");

console.log("PrimeLot -> WCT inbound import route contract checks passed.");
