# Supabase Auth email branding for Wicked Card Tracker

Goal: signup confirmation and password reset emails should say **Wicked Card Tracker**, not **Supabase**.

## What has to change

Supabase sends Auth emails from Supabase-branded infrastructure unless the project uses a custom SMTP provider. To remove the visible "Supabase" sender/branding, configure:

1. Custom SMTP sender
2. Auth email templates
3. Site URL and redirect URLs
4. Domain DNS verification for the email provider

## Recommended sender

Use one of these:

- `Wicked Card Tracker <no-reply@wickedcardtracker.com>` for automated auth emails
- `Wicked Card Tracker <support@wickedcardtracker.com>` if replies should go to support

For auth/security emails, `no-reply@wickedcardtracker.com` is usually cleaner.

## Supabase Dashboard steps

Open the WCT Supabase project:

- Project URL currently used by the app: `https://mtfxglhyagiljokxssga.supabase.co`

Then go to:

```text
Supabase Dashboard → Authentication → Settings → SMTP Settings
```

Enable custom SMTP and enter the SMTP provider values.

Typical fields:

```text
Sender name: Wicked Card Tracker
Sender email: no-reply@wickedcardtracker.com
SMTP host: <from email provider>
SMTP port: 587
SMTP user: <from email provider>
SMTP password: <from email provider>
Minimum interval between emails: keep default unless rate limited
```

## Email provider options

Recommended providers:

- Resend: simplest domain setup for transactional emails
- Postmark: very reliable transactional email
- SendGrid: common, more dashboard-heavy

Avoid sending production Auth mail through a personal Gmail account.

## DNS records

The email provider will give DNS records for `wickedcardtracker.com`, usually:

- SPF TXT
- DKIM CNAME/TXT records
- Optional DMARC TXT

Because `wickedcardtracker.com` uses Vercel DNS, add those records in:

```text
Vercel → wickedcardtracker.com → DNS Records
```

Do not skip DKIM/SPF, or password reset emails may land in spam.

## Supabase Auth URL settings

Go to:

```text
Supabase Dashboard → Authentication → URL Configuration
```

Set:

```text
Site URL: https://wickedcardtracker.com
Redirect URLs:
https://wickedcardtracker.com
https://wickedcardtracker.com/
http://localhost:3000
http://localhost:3000/
```

If preview deployments need auth callbacks, add the Vercel preview URL pattern if Supabase accepts it for the project, or add the specific preview URLs when testing.

## Email templates

Go to:

```text
Supabase Dashboard → Authentication → Email Templates
```

### Confirm signup subject

```text
Confirm your Wicked Card Tracker account
```

### Confirm signup body

```html
<h2>Welcome to Wicked Card Tracker</h2>

<p>Thanks for signing up. Confirm your email to start tracking your card inventory, listings, sales, and profit.</p>

<p>
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#39ff9c;color:#020617;font-weight:700;text-decoration:none;">
    Confirm my account
  </a>
</p>

<p>If the button does not work, copy and paste this link into your browser:</p>
<p>{{ .ConfirmationURL }}</p>

<p>— Wicked Card Tracker</p>
```

### Password recovery subject

```text
Reset your Wicked Card Tracker password
```

### Password recovery body

```html
<h2>Reset your Wicked Card Tracker password</h2>

<p>We received a request to reset your password. Use the secure link below to choose a new password.</p>

<p>
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#39ff9c;color:#020617;font-weight:700;text-decoration:none;">
    Reset my password
  </a>
</p>

<p>If the button does not work, copy and paste this link into your browser:</p>
<p>{{ .ConfirmationURL }}</p>

<p>If you did not request this, you can ignore this email.</p>

<p>— Wicked Card Tracker</p>
```

## Test checklist

After saving SMTP + templates:

1. Sign up with a test email.
2. Confirm the sender shows `Wicked Card Tracker`, not `Supabase`.
3. Confirm the email subject uses Wicked Card Tracker.
4. Click the confirmation link and verify it lands on `https://wickedcardtracker.com`.
5. Trigger password reset.
6. Confirm reset email sender/subject/body are branded.
7. Click reset link and verify WCT opens in password recovery mode.
8. Check spam/promotions folder if delivery is slow.

## Notes

- This is mostly Supabase/dashboard + email DNS setup, not a code change.
- The WCT app already passes `window.location.origin` as the redirect target for signup and password reset, so production emails should redirect back to the current WCT domain once Supabase URL Configuration allows it.
- If emails still show Supabase after enabling SMTP, check both the SMTP sender fields and each Auth email template subject/body.
