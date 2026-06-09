const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const statusRoute = fs.readFileSync(path.join(root, "app/api/primelot/connection-status/route.ts"), "utf8");
const connectionRoute = fs.readFileSync(path.join(root, "app/api/primelot/connection/route.ts"), "utf8");
const importRoute = fs.readFileSync(path.join(root, "app/api/primelot/import/route.ts"), "utf8");

assert(statusRoute.includes('export async function POST(request: NextRequest)'), "Connection-status route exposes POST.");
assert(statusRoute.includes('process.env.PRIMELOT_TO_WCT_IMPORT_SECRET'), "Connection-status route uses shared server secret.");
assert(statusRoute.includes('request.headers.get("x-wct-webhook-secret")'), "Connection-status route requires X-WCT-Webhook-Secret.");
assert(statusRoute.includes('request.headers.get("x-wct-integration")'), "Connection-status route requires X-WCT-Integration.");
assert(statusRoute.includes('integration === "primelot"'), "Connection-status route restricts callers to PrimeLot integration header.");
assert(statusRoute.includes('.from("primelot_connections")'), "Connection-status route resolves from primelot_connections.");
assert(statusRoute.includes('.eq("status", "active")'), "Connection-status route only uses active connections.");
assert(statusRoute.includes('"primelot_seller_user_id"') && statusRoute.includes('"primelot_seller_email"'), "Connection-status route matches seller id first and email fallback.");
assert(statusRoute.indexOf('"primelot_seller_user_id"') < statusRoute.indexOf('"primelot_seller_email"'), "Seller user id matching should be preferred before email fallback.");
assert(statusRoute.includes('AMBIGUOUS_WCT_ACCOUNT'), "Connection-status route returns ambiguous-account errors.");
assert(statusRoute.includes('return inactiveResponse();'), "Connection-status route returns connected false when no active match exists.");
assert(!statusRoute.includes('primeLotWctUserId') && !statusRoute.includes('wctUserId'), "Connection-status response must not expose or accept arbitrary WCT user ids.");

assert(connectionRoute.includes('export async function DELETE(request: NextRequest)'), "WCT connection route exposes a disconnect flow.");
assert(connectionRoute.includes('status: "disconnected"'), "Disconnect flow marks the shared connection row disconnected.");
assert(connectionRoute.includes('disconnected_at: new Date().toISOString()'), "Disconnect flow timestamps disconnected_at.");

assert(importRoute.includes('findConnectionRows') && importRoute.includes('resolveConnectionRows'), "Import route should share the active-connection matching behavior.");
assert(importRoute.indexOf('"primelot_seller_user_id"') < importRoute.indexOf('"primelot_seller_email"'), "Import route should prefer seller id before email fallback.");
assert(!importRoute.includes('wctUserId') && !importRoute.includes('WctUserId'), "Import route must not accept arbitrary WCT user ids from PrimeLot.");

console.log("PrimeLot connection bridge contract checks passed.");
