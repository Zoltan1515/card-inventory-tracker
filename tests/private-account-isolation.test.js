const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const primeLotConnection = fs.readFileSync(path.join(root, 'app', 'api', 'primelot', 'connection', 'route.ts'), 'utf8');
const primeLotPost = fs.readFileSync(path.join(root, 'app', 'api', 'primelot', 'post-listings', 'route.ts'), 'utf8');
const primeLotClear = fs.readFileSync(path.join(root, 'app', 'api', 'primelot', 'clear-listing', 'route.ts'), 'utf8');

const requiredUserScopedQueries = [
  'supabase.from("cards").select("*").eq("user_id", userId)',
  'supabase.from("expenses").select("*").eq("user_id", userId)',
  'supabase.from("cash_adjustments").select("*").eq("user_id", userId)',
  'supabase.from("grading_submissions").select("*").eq("user_id", userId)',
  'setWorkspaceId(null);',
];

for (const snippet of requiredUserScopedQueries) {
  if (!page.includes(snippet)) throw new Error(`Missing private account data query: ${snippet}`);
}

const forbiddenPageSnippets = [
  'from("workspace_members")',
  'workspaceCardsResult',
  'workspaceExpensesResult',
  'workspaceCashResult',
  'workspaceGradingResult',
  '.eq("workspace_id", activeWorkspaceId)',
];

for (const snippet of forbiddenPageSnippets) {
  if (page.includes(snippet)) throw new Error(`Main app should not load workspace-shared data: ${snippet}`);
}

const mutationScopeSnippets = [
  'updateQuery = updateQuery.eq("user_id", session.user.id);',
  'deleteQuery = deleteQuery.eq("user_id", session.user.id);',
  'legacyExpenseQuery = legacyExpenseQuery.eq("user_id", session.user.id);',
  'legacyQuantityQuery = legacyQuantityQuery.eq("user_id", session.user.id);',
];

for (const snippet of mutationScopeSnippets) {
  if (!page.includes(snippet)) throw new Error(`Mutations must stay user-scoped: ${snippet}`);
}

for (const [name, source] of Object.entries({ primeLotConnection, primeLotPost, primeLotClear })) {
  if (source.includes('from("workspace_members")')) {
    throw new Error(`${name} should not read workspace membership for PrimeLot routing`);
  }
}

if (!primeLotConnection.includes('return null;')) throw new Error('PrimeLot connection route should return null workspace id for privacy-first behavior');
if (!primeLotPost.includes('const workspaceId = null;')) throw new Error('PrimeLot post route should use per-user connection only');
if (!primeLotClear.includes('const workspaceId = null;')) throw new Error('PrimeLot clear route should use per-user connection only');

console.log('Private account isolation checks passed.');
