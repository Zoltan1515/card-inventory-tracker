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
assert(route.includes('rowWithoutSourceTracking'), "Route has notes-based fallback if source columns are missing.");

assert(mapper.includes('status: "Not Listed"'), "Mapper defaults imported listings to Not Listed.");
assert(mapper.includes('listed_platform: ""'), "Mapper keeps listedPlatform blank.");
assert(mapper.includes('listing_url: ""'), "Mapper keeps WCT listingUrl blank.");
assert(mapper.includes('PrimeLot Listing Type'), "Mapper preserves PrimeLot listing type in notes.");
assert(mapper.includes('single_card') && mapper.includes('sealed_product') && mapper.includes('lot'), "Mapper supports all PrimeLot listing types.");
assert(mapper.includes('images.frontUrl') && mapper.includes('images.backUrl'), "Mapper accepts front/back image URLs.");

assert(serverSupabase.includes('SUPABASE_SERVICE_ROLE_KEY'), "Server Supabase client uses service role env var.");
assert(migration.includes('source_platform') && migration.includes('source_id'), "Migration adds source tracking columns.");
assert(migration.includes('cards_user_source_unique'), "Migration adds unique source-tracking index.");

console.log("PrimeLot -> WCT inbound import route contract checks passed.");
