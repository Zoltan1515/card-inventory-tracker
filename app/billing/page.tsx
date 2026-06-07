import type { Metadata } from "next";

const stripePortalUrl = process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL || "#stripe-customer-portal-coming-soon";
const hasStripePortalUrl = stripePortalUrl.startsWith("http");

export const metadata: Metadata = {
  title: "Billing | Wicked Card Tracker",
  description: "Manage Wicked Card Tracker subscription status, renewal, cancellation, and PrimeLot seller discount details.",
};

export default function BillingPage() {
  return (
    <main className="pricingShell billingShell">
      <section className="pricingHero billingHero">
        <div className="pricingHeroCopy">
          <a className="pricingLogo" href="/" aria-label="Wicked Card Tracker home">
            <img src="/wicked-card-tracker-logo.png" alt="Wicked Card Tracker" />
          </a>
          <p className="eyebrow">Account & billing</p>
          <h1>Know exactly what access you have.</h1>
          <p className="pricingLead">This page is where your WCT renewal date, cancellation link, payment status, and PrimeLot seller discount will live once Stripe subscriptions are connected.</p>
          <div className="pricingHeroActions">
            <a className="primary pricingCta" href="/pricing">View pricing</a>
            <a className="secondary pricingCta" href="/">Back to tracker</a>
          </div>
        </div>
        <aside className="pricingCard billingStatusCard" aria-label="Current billing setup status">
          <span className="pricingBadge">Current setup</span>
          <h2>Account login is active.</h2>
          <p className="muted">Paid subscription tracking is not connected to this login yet, so renewal dates and cancellation controls will appear after Stripe billing is fully connected.</p>
          <div className="billingStatusList">
            <div><span>App account</span><strong>Active when signed in</strong></div>
            <div><span>Paid subscription</span><strong>Not connected yet</strong></div>
            <div><span>Renewal date</span><strong>Unavailable until Stripe is connected</strong></div>
            <div><span>PrimeLot seller discount</span><strong>$5/month eligible once tied to billing</strong></div>
          </div>
          {hasStripePortalUrl ? (
            <a className="primary pricingCta fullWidth" href={stripePortalUrl} target="_blank" rel="noopener noreferrer">Open billing portal</a>
          ) : (
            <span className="primary pricingCta fullWidth billingPortalDisabled" aria-disabled="true">Billing portal coming after Stripe setup</span>
          )}
        </aside>
      </section>

      <section className="pricingGridSection billingGridSection">
        <div>
          <p className="eyebrow">What this will show</p>
          <h2>Subscription controls users expect.</h2>
          <p className="pricingLead">Once Stripe is connected, this page should become the place customers can verify their plan, renewal, cancellation options, and discount status without messaging you.</p>
        </div>
        <div className="pricingFeatureGrid">
          <article className="pricingFeatureCard">
            <span className="pricingFeatureIcon">✓</span>
            <div><p className="eyebrow">Plan status</p><h3>Active or canceled</h3><p>Show whether the subscription is active, trialing, past due, canceled, or unpaid.</p></div>
          </article>
          <article className="pricingFeatureCard">
            <span className="pricingFeatureIcon">↻</span>
            <div><p className="eyebrow">Renewal</p><h3>Next renewal date</h3><p>Show when the next charge happens, or when access ends after cancellation.</p></div>
          </article>
          <article className="pricingFeatureCard">
            <span className="pricingFeatureIcon">−</span>
            <div><p className="eyebrow">Discount</p><h3>PrimeLot $5 off</h3><p>Show the discounted $15/month price when the account is connected to PrimeLot seller billing.</p></div>
          </article>
        </div>
      </section>
    </main>
  );
}
