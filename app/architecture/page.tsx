import type { Metadata } from "next";
/* eslint-disable @next/next/no-html-link-for-pages -- plain anchors avoid a vinext production prefetch crash */
import "./architecture.css";

export const metadata: Metadata = {
  title: "DONE Architecture — Live proof and trust boundaries",
  description: "The implemented commerce, x402, Avalanche, and AWS execution architecture behind DONE.",
  openGraph: { images: [] },
  twitter: { images: [] },
};

const SNOWTRACE = "https://testnet.snowtrace.io/tx/0x920f3ee1e61ec5cfac585a86aaf1261dbcc7bab1ec1587e449bac86fd2031335";

type Status = "live" | "executed" | "sandbox" | "simulated";

function Node({ status, eyebrow, title, children }: {
  status: Status;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className={`architecture-node ${status}`}>
      <div className="node-top"><span>{eyebrow}</span><em>{status === "simulated" ? "SIMULATED UI" : status.toUpperCase()}</em></div>
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  );
}

export default function Architecture() {
  return (
    <main className="architecture-page">
      <header className="architecture-hero">
        <nav><a href="/">← Interactive demo</a><a href={SNOWTRACE} target="_blank" rel="noreferrer">Snowtrace proof ↗</a></nav>
        <div className="architecture-kicker"><span /> IMPLEMENTED ARCHITECTURE</div>
        <h1>One simple message.<br /><em>Four inspectable boundaries.</em></h1>
        <p>DONE turns an outcome into a ranked product, a single-use authority, a machine payment, and a replay-safe execution record. The labels below state exactly what ran and what remains a sandbox.</p>
        <div className="legend" aria-label="Architecture status legend">
          <span className="live">LIVE</span><span className="executed">EXECUTED</span><span className="sandbox">SANDBOX</span><span className="simulated">SIMULATED UI</span>
        </div>
      </header>

      <section className="architecture-grid" aria-label="DONE system architecture">
        <div className="boundary experience-boundary">
          <div className="boundary-heading"><span>01</span><div><b>Customer experience</b><small>One request. One approval.</small></div></div>
          <Node status="simulated" eyebrow="Interface" title="iMessage experience">The public site reproduces the intended Messages flow without exposing a private Apple account.</Node>
          <Node status="live" eyebrow="Outcome" title="Request parser">Resolves quantity, no-added-sugar constraint, saved delivery scope, and maximum spend.</Node>
        </div>

        <div className="boundary decision-boundary">
          <div className="boundary-heading"><span>02</span><div><b>Decision and authority</b><small>Deterministic before autonomous.</small></div></div>
          <Node status="live" eyebrow="Selection" title="BEST policy engine">Rejects hard-constraint failures, ranks delivered value, and publishes every reason.</Node>
          <Node status="live" eyebrow="Guardrail" title="Single-use mandate">Binds amount, merchant, delivery scope, expiry, and idempotency key before execution.</Node>
          <Node status="executed" eyebrow="Signer" title="Local wallet boundary">Signed the Fuji authorization locally. The private key never reached the UI, model, or AWS.</Node>
        </div>

        <div className="boundary payment-boundary">
          <div className="boundary-heading"><span>03</span><div><b>Payment and commerce</b><small>Machine-readable value transfer.</small></div></div>
          <Node status="executed" eyebrow="Protocol" title="StraitsX x402">Returned an exact HTTP 402 request and accepted an EIP-3009 payment authorization.</Node>
          <Node status="executed" eyebrow="Settlement" title="Avalanche Fuji">Settled 10 test XSGD on C-Chain and verified the emitted transfer event.</Node>
          <Node status="sandbox" eyebrow="Capability" title="Card + merchant checkout">Returns a non-spendable card reference and a clearly labelled sandbox coffee order.</Node>
        </div>

        <div className="boundary aws-boundary">
          <div className="boundary-heading"><span>04</span><div><b>AWS execution evidence</b><small>Validate once. Retry safely.</small></div></div>
          <Node status="live" eyebrow="Compute" title="AWS Lambda">Rejects evidence outside the mandate, merchant, budget, Fuji chain, and test-XSGD payment.</Node>
          <Node status="live" eyebrow="State" title="Amazon DynamoDB">A conditional write stores one immutable audit record; the same request returns the first result.</Node>
          <Node status="live" eyebrow="Operations" title="CloudWatch + X-Ray">Provides retained logs, active tracing, integrity hashes, and request identifiers without wallet secrets.</Node>
        </div>
      </section>

      <section className="execution-proof">
        <div className="proof-copy"><span>THE EXECUTED PATH</span><h2>Ask → approve → pay → validate → prove</h2><p>A real sponsor-sandbox x402 payment was settled, then the sanitized evidence was submitted twice to AWS. The first invocation stored it; the second was safely recognized as a replay.</p></div>
        <div className="proof-path" aria-label="Executed proof sequence">
          <div><i>1</i><b>HTTP 402</b><span>Exact 10 XSGD request</span></div><em>→</em>
          <div><i>2</i><b>Fuji</b><span>On-chain settlement</span></div><em>→</em>
          <div><i>3</i><b>Lambda</b><span>Evidence validated</span></div><em>→</em>
          <div><i>4</i><b>DynamoDB</b><span>Replay blocked</span></div>
        </div>
      </section>

      <section className="trust-boundary">
        <div><span>TRUST BOUNDARY</span><h2>What never leaves the user</h2></div>
        <ul><li>Wallet private key</li><li>Card PAN or CVV</li><li>OTP or Apple credentials</li><li>Full delivery address</li></ul>
      </section>

      <footer><a href="/">Run the demo <span>→</span></a><p>DONE · Don’t buy products. Buy outcomes.</p></footer>
    </main>
  );
}
