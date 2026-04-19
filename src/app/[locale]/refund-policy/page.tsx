export default function RefundPolicyPage() {
  return (
    <main className="legal-page">
      <h1>Refund Policy</h1>
      <p>Last updated: April 16, 2026</p>
      <p>GoldBot includes a specific performance-based refund condition described below, plus standard support review for other requests.</p>

      <section className="legal-block">
        <h2>2-Week SL Full Refund Guarantee</h2>
        <p>If the EA gets a stop loss (SL) within the first 14 calendar days from purchase, the robot price is refunded 100%.</p>
      </section>

      <section className="legal-block">
        <h2>Claim Requirements</h2>
        <p>To process this guarantee, submit your purchase email, order details, and MT5 proof of the SL event within the same 14-day window.</p>
      </section>

      <section className="legal-block">
        <h2>General Refund Requests</h2>
        <p>Requests outside the 14-day SL guarantee are reviewed case-by-case and may be denied if terms were breached or service delivery was completed.</p>
      </section>
    </main>
  );
}
