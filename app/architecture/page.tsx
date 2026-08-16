import type { Metadata } from "next";
import "./architecture.css";

export const metadata: Metadata = {
  title: "DONE Architecture — Live proof and trust boundaries",
  description: "The implemented commerce, x402, Avalanche, and AWS execution architecture behind DONE.",
  openGraph: { images: [] },
  twitter: { images: [] },
};

const MAINNET_SNOWTRACE = "https://snowtrace.io/tx/0x7cad6ef81b1bd4e35860f2d4351098d964d776a4513df02491f338200faba2f5";

type Status = "live" | "executed" | "sandbox";

function Node({ status, eyebrow, title, children }: {
  status: Status;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className={`architecture-node ${status}`}>
      <div className="node-top"><span>{eyebrow}</span><em>{status.toUpperCase()}</em></div>
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  );
}

export default function Architecture() {
  return (
    <main className="architecture-page">
      <header className="architecture-hero">
        <nav><a href="/live">← Live evidence console</a><a href={MAINNET_SNOWTRACE} target="_blank" rel="noreferrer">Mainnet Snowtrace proof ↗</a></nav>
        <div className="architecture-kicker"><span /> IMPLEMENTED ARCHITECTURE</div>
        <h1>One simple message.<br /><em>Four inspectable boundaries.</em></h1>
        <p>DONE turns an outcome into a ranked product, a single-use authority, a machine payment, and a replay-safe execution record. The labels below state exactly what ran and what remains a sandbox.</p>
        <div className="legend" aria-label="Architecture status legend">
          <span className="live">LIVE</span><span className="executed">EXECUTED</span><span className="sandbox">SANDBOX</span>
        </div>
      </header>

      <section className="architecture-grid" aria-label="DONE system architecture">
        <div className="boundary experience-boundary">
          <div className="boundary-heading"><span>01</span><div><b>Customer experience</b><small>One request. One approval.</small></div></div>
          <Node status="live" eyebrow="Interface" title="Native iMessage agent">Watches one private Messages conversation on this Mac and replies through the Messages app. The judge console exposes execution evidence, not Apple credentials.</Node>
          <Node status="live" eyebrow="Outcome" title="OpenAI request parser">Resolves the item, quantity, constraints, delivery scope, and the customer’s exact maximum spend. It never substitutes a fixed demo budget.</Node>
        </div>

        <div className="boundary decision-boundary">
          <div className="boundary-heading"><span>02</span><div><b>Decision and authority</b><small>Deterministic before autonomous.</small></div></div>
          <Node status="live" eyebrow="Discovery" title="Shopify catalogue fetch">Fetches the live merchant catalogue after YES, records HTTP status, time, product count, and a SHA-256 response fingerprint.</Node>
          <Node status="live" eyebrow="Selection" title="BEST policy engine">Rejects hard-constraint failures, ranks delivered value, and publishes every reason.</Node>
          <Node status="live" eyebrow="Guardrail" title="Single-use mandate">Binds amount, merchant, delivery scope, expiry, and idempotency key before execution.</Node>
          <Node status="executed" eyebrow="Signer" title="Local wallet boundary">Signed the Fuji authorization locally. The private key never reached the UI, model, or AWS.</Node>
        </div>

        <div className="boundary payment-boundary">
          <div className="boundary-heading"><span>03</span><div><b>Payment and commerce</b><small>Machine-readable value transfer.</small></div></div>
          <Node status="executed" eyebrow="Protocol" title="StraitsX x402">Returned an exact HTTP 402 request and accepted an EIP-3009 payment authorization.</Node>
          <Node status="executed" eyebrow="Settlement" title="Avalanche Fuji">Settles the selected product’s exact test-XSGD total on C-Chain and verifies the emitted transfer event.</Node>
          <Node status="executed" eyebrow="Mainnet proof" title="Real XSGD transfer">A separately approved 0.10 XSGD controlled-wallet transfer confirmed on Avalanche mainnet. This proves real settlement without mislabelling it as a merchant order.</Node>
          <Node status="sandbox" eyebrow="Capability" title="Card + merchant checkout">Returns the sponsor sandbox capability and prepares a real Shopify cart handoff. A physical retail order is never claimed without a production card rail.</Node>
        </div>

        <div className="boundary aws-boundary">
          <div className="boundary-heading"><span>04</span><div><b>AWS execution evidence</b><small>Validate once. Retry safely.</small></div></div>
          <Node status="live" eyebrow="Compute" title="AWS Lambda">Rejects evidence outside the mandate, merchant, budget, Fuji chain, and test-XSGD payment.</Node>
          <Node status="live" eyebrow="State" title="Amazon DynamoDB">A conditional write stores one immutable audit record; the same request returns the first result.</Node>
          <Node status="live" eyebrow="Operations" title="CloudWatch + X-Ray">Provides retained logs, active tracing, integrity hashes, and request identifiers without wallet secrets.</Node>
        </div>
      </section>

      <section className="execution-proof">
        <div className="proof-copy"><span>THE EXECUTED PATH</span><h2>Ask → approve → discover → pay → validate → prove</h2><p>After explicit approval, DONE fetches and fingerprints the live merchant response, applies the public selection policy, settles the exact sponsor-sandbox x402 amount, and sends sanitized evidence to AWS for validation and replay-safe storage.</p></div>
        <div className="proof-path" aria-label="Executed proof sequence">
          <div><i>1</i><b>Shopify</b><span>Live candidates + source hash</span></div><em>→</em>
          <div><i>2</i><b>HTTP 402 + Fuji</b><span>Exact selected total settled</span></div><em>→</em>
          <div><i>3</i><b>Lambda</b><span>Mandate + evidence validated</span></div><em>→</em>
          <div><i>4</i><b>DynamoDB</b><span>Immutable audit stored</span></div>
        </div>
      </section>

      <section className="trust-boundary">
        <div><span>TRUST BOUNDARY</span><h2>What never leaves the user</h2></div>
        <ul><li>Wallet private key</li><li>Card PAN or CVV</li><li>OTP or Apple credentials</li><li>Full delivery address</li></ul>
      </section>

      <footer><a href="/live">Open live console <span>→</span></a><p>DONE · Don’t buy products. Buy outcomes.</p></footer>
    </main>
  );
}
