import type { Metadata } from "next";

const stripeCheckoutUrl = process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL || "#stripe-checkout-coming-soon";
const hasStripeCheckoutUrl = stripeCheckoutUrl.startsWith("http");

export const metadata: Metadata = {
  title: "Pricing | Wicked Card Tracker",
  description: "Start Wicked Card Tracker with 1 month free, then $20/month. PrimeLot Cards sellers save $5/month.",
};

const benefits = [
  "Track every card purchase, sale, expense, and profit number in one clean dashboard.",
  "See real profit after grading costs, shipping, marketplace fees, supplies, taxes, and other expenses.",
  "Organize inventory by Not Listed, Listed, Sold, and cards that need attention.",
  "Track grading submissions, cards out for grading, quantities, costs, and returned grades.",
  "Connect your selling workflow with PrimeLot Cards when you are ready to list and sell.",
  "Use plain, simple reports to understand your hobby like a real business.",
];

const featureCards = [
  {
    title: "Inventory tracking",
    copy: "Keep your purchases, quantities, listing status, photos, asking prices, and card details organized.",
  },
  {
    title: "Real profit numbers",
    copy: "Track card cost, shipping, grading, fees, expenses, and sale revenue so profit is not a guessing game.",
  },
  {
    title: "Grading workflow",
    copy: "Know what is out for grading, how many cards were sent, what it cost, and what came back.",
  },
];

export default function PricingPage() {
  return (
    <main className="pricingShell">
      <section className="pricingHero panel">
        <div className="pricingHeroCopy">
          <a href="/" className="brandLogo pricingLogo" aria-label="Wicked Card Tracker home">
            <img src="/wicked-card-tracker-logo.png" alt="Wicked Card Tracker" />
          </a>
          <p className="eyebrow">Wicked Card Tracker Pricing</p>
          <h1>Run your card hobby like a real business.</h1>
          <p className="subhead">
            Get your first month free, then keep tracking inventory, sales, expenses, grading, and profit for one simple monthly price.
          </p>
          <div className="pricingHeroActions">
            <a className="primary pricingCta" href={stripeCheckoutUrl} target={hasStripeCheckoutUrl ? "_blank" : undefined} rel={hasStripeCheckoutUrl ? "noopener noreferrer" : undefined}>
              Start your free month
            </a>
            <a className="secondary pricingCta" href="/">
              Back to the tracker
            </a>
          </div>
        </div>

        <aside className="pricingCard" aria-label="Wicked Card Tracker monthly plan">
          <div className="pricingBadge">1 month free</div>
          <div className="pricingPlanName">Wicked Card Tracker</div>
          <div className="pricingAmount">
            <span>$</span>20<small>/month</small>
          </div>
          <p className="muted">After your free first month.</p>
          <div className="primeLotDiscount">
            <span>PrimeLot Cards seller discount</span>
            <strong>$5 off every month</strong>
            <small>PrimeLot Cards sellers pay $15/month after the free month.</small>
          </div>
          <a className="primary pricingCta fullWidth" href={stripeCheckoutUrl} target={hasStripeCheckoutUrl ? "_blank" : undefined} rel={hasStripeCheckoutUrl ? "noopener noreferrer" : undefined}>
            Start your free month
          </a>
        </aside>
      </section>

      <section className="pricingGridSection">
        <div className="panel pricingBenefitsPanel">
          <div className="panelHeader pricingSectionHeader">
            <div>
              <p className="eyebrow">What you get</p>
              <h2>Everything you need to understand your card numbers.</h2>
            </div>
          </div>
          <div className="pricingBenefitsList">
            {benefits.map((benefit) => (
              <div className="pricingBenefit" key={benefit}>
                <span>✓</span>
                <p>{benefit}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="pricingFeatureGrid">
          {featureCards.map((feature) => (
            <article className="pricingFeatureCard" key={feature.title}>
              <span className="pricingFeatureIcon">✓</span>
              <div>
                <p className="eyebrow">Included</p>
                <h3>{feature.title}</h3>
                <p className="muted">{feature.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="pricingFinalCta panel">
        <p className="eyebrow">Start simple</p>
        <h2>Try Wicked Card Tracker free for 1 month.</h2>
        <p className="subhead">
          Organize your inventory, know your real profit, and make better buying and selling decisions.
        </p>
        <a className="primary pricingCta" href={stripeCheckoutUrl} target={hasStripeCheckoutUrl ? "_blank" : undefined} rel={hasStripeCheckoutUrl ? "noopener noreferrer" : undefined}>
          Start your free month
        </a>
      </section>
    </main>
  );
}
