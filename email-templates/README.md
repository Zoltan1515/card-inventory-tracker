# Wicked Card Tracker email setup

These templates match the live WCT dark neon theme and use the logo hosted at:

`https://wickedcardtracker.com/wicked-card-tracker-logo.png`

## Supabase Auth emails

Supabase Auth email templates are configured in the Supabase Dashboard, not from this Next.js app.

Project: `mtfxglhyagiljokxssga`

Go to:

Supabase Dashboard → Authentication → Email Templates

Set these templates:

- **Confirm signup**
  - Subject: `Welcome to Wicked Card Tracker — confirm your email`
  - Body: copy `email-templates/welcome-confirm-signup.html`

- **Reset password**
  - Subject: `Reset your Wicked Card Tracker password`
  - Body: copy `email-templates/reset-password.html`

Required Supabase URL settings:

- Site URL: `https://wickedcardtracker.com`
- Redirect URLs should include:
  - `https://wickedcardtracker.com/*`
  - `http://localhost:3000/*` for local testing if needed

The app now calls:

- `supabase.auth.signUp({ emailRedirectTo: window.location.origin + "/" })`
- `supabase.auth.resetPasswordForEmail(..., { redirectTo: window.location.origin + "/" })`

It also listens for Supabase `PASSWORD_RECOVERY` and shows an on-theme new-password form.

## Subscription emails

Stripe’s built-in customer emails are controlled in the Stripe Dashboard:

Stripe Dashboard → Settings → Customer emails

Enable at least:

- Successful payments
- Failed payments
- Trial ending, if desired

Stripe’s built-in emails have limited HTML/theme customization. For a fully branded WCT subscription email, use these repo templates with a webhook email provider such as Resend, SendGrid, or Postmark:

- `email-templates/subscription-welcome.html`
- `email-templates/subscription-receipt.html`

Recommended subscription email events:

- `checkout.session.completed` → send `subscription-welcome.html`
- `invoice.payment_succeeded` → send `subscription-receipt.html`
- `invoice.payment_failed` → send a failed-payment variant before locking access

Current app note: the pricing CTA is already Stripe-ready through `NEXT_PUBLIC_STRIPE_CHECKOUT_URL`. Once Stripe Checkout is created, set that Vercel env var and redeploy.
