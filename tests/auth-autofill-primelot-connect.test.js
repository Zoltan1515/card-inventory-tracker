const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, '..', 'app', 'page.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  page.includes('const authFormRef = useRef<HTMLFormElement>(null);')
    && page.includes('authFormRef.current?.elements.namedItem(name)'),
  'AuthPanel should read submitted email/password from the live form so browser/password-manager autofill is not ignored by React state.'
);

assert(
  page.includes('<form ref={authFormRef} className="authForm" onSubmit={submit}>')
    && page.includes('name="email" autoComplete="email"')
    && page.includes('name="password" autoComplete={mode === "signup" ? "new-password" : "current-password"}'),
  'Auth fields should expose name/autocomplete attributes for reliable autofill and form submission.'
);

assert(
  page.includes('await supabase.auth.signInWithPassword({ email: submittedEmail, password: submittedPassword });')
    && !page.includes('await supabase.auth.signInWithPassword({ email, password });'),
  'Sign-in should use the submitted form values, not stale React state.'
);

assert(
  page.includes('const PRIMELOT_CONNECT_INTENT_PATTERN = /(primelot|prime-lot|wct-connect|connect-wicked)/i;')
    && page.includes('hasPrimeLotConnectIntent()')
    && page.includes('setPrimeLotModalOpen(true);'),
  'A PrimeLot connect intent in the URL should automatically continue into the WCT PrimeLot connection modal after login.'
);

console.log('Auth autofill and PrimeLot connect intent checks passed.');
