"use client";

import { useEffect, useMemo, useState } from "react";
import "./live.css";

type Candidate = {
  id: string;
  title: string;
  variantTitle: string;
  merchant: string;
  deliveredTotalSgd: number;
  available: boolean;
  eligible: boolean;
  score: number;
  reasons: string[];
  productUrl: string;
};

type LiveState = {
  runId: string;
  stage: string;
  updatedAt: string;
  truthfulMode: string;
  request?: { summary?: string; item?: string; quantity?: number; deliveryLocation?: string; budgetSgd?: number; constraints?: string[] } | null;
  approval?: { status: string; maxSpendSgd: number; source: string } | null;
  discovery?: {
    source: string;
    endpoint: string;
    fetchedAt: string;
    httpStatus: number;
    totalProducts: number;
    evaluatedVariants: number;
    sourceSha256: string;
    shipping: { freeShipping: boolean; evidence: string };
    policy: { name: string; hardGates: string[]; ranking: string };
    candidates: Candidate[];
    selected: Candidate;
  } | null;
  payment?: { payment: { amountSgd: number; token: string }; settlement: { transactionHash: string; explorerUrl: string; network: string; status: string } } | null;
  aws?: { functionName: string; tableName: string; logGroupName: string; requestId: string; outcome: string; region: string } | null;
  receipt?: { status: string; selectedProduct: string; merchant: string; amountSgd: number; productUrl: string; cartUrl: string; cartPrepared: boolean; physicalOrderPlaced: boolean; note: string } | null;
  events: Array<{ at: string; stage: string; title: string; detail: string; kind: string }>;
};

const stageRank: Record<string, number> = {
  listening: 0,
  "approval-required": 1,
  discovering: 2,
  selected: 3,
  paying: 4,
  paid: 5,
  aws: 6,
  complete: 7,
  failed: 7,
};

const architecture = [
  { rank: 1, name: "iMessage", detail: "Explicit customer authority", tone: "live" },
  { rank: 1, name: "OpenAI", detail: "Intent + budget extraction", tone: "live" },
  { rank: 2, name: "Shopify", detail: "Live catalogue evidence", tone: "live" },
  { rank: 3, name: "BEST policy", detail: "Deterministic selection", tone: "live" },
  { rank: 4, name: "StraitsX x402", detail: "Sandbox capability", tone: "sandbox" },
  { rank: 5, name: "Avalanche Fuji", detail: "Confirmed test XSGD", tone: "executed" },
  { rank: 6, name: "AWS Lambda", detail: "Evidence validation", tone: "live" },
  { rank: 7, name: "DynamoDB + CloudWatch", detail: "Audit + observability", tone: "live" },
] as const;

function short(value?: string, head = 12, tail = 8) {
  if (!value) return "Pending";
  return value.length > head + tail + 2 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}

function time(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function LiveExecutionPage() {
  const [state, setState] = useState<LiveState | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch(`/live-execution.json?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const next = await response.json() as LiveState;
        if (active) { setState(next); setError(""); }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Live state unavailable");
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 650);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const rank = stageRank[state?.stage || "listening"] || 0;
  const candidates = state?.discovery?.candidates || [];
  const selectedId = state?.discovery?.selected?.id;
  const headline = useMemo(() => {
    if (!state) return "Connecting to the live agent…";
    if (state.stage === "listening") return "Waiting for the customer’s iMessage";
    if (state.stage === "approval-required") return "Bounded approval requested";
    if (state.stage === "discovering") return "Searching the live merchant catalogue";
    if (state.stage === "selected") return "Best eligible result selected";
    if (state.stage === "paying") return "Executing the x402 payment";
    if (state.stage === "paid") return "Fuji settlement confirmed";
    if (state.stage === "aws") return "AWS is validating the evidence";
    if (state.stage === "complete") return "Outcome executed — proof attached";
    return "Execution stopped safely";
  }, [state]);

  return (
    <main className="live-shell">
      <header className="live-header">
        <div className="live-brand"><span>D</span><div><b>DONE</b><small>Judge evidence console</small></div></div>
        <div className="live-truth"><i /> {state?.truthfulMode || "LIVE EXECUTION"}</div>
        <div className="live-clock"><small>LAST EVIDENCE</small><b>{time(state?.updatedAt)}</b></div>
      </header>

      <section className="live-hero">
        <div><span>RUN · {short(state?.runId, 18, 5)}</span><h1>{headline}</h1><p>Every completed stage below has a source, timestamp, or externally verifiable receipt.</p></div>
        <div className={`stage-badge ${state?.stage === "failed" ? "failed" : ""}`}><i />{(state?.stage || "connecting").replaceAll("-", " ")}</div>
      </section>

      {error && <div className="live-error">Live state: {error}. Keep the local agent and web app running.</div>}

      <section className="live-layout">
        <div className="live-main">
          <section className="evidence-card timeline-card">
            <div className="card-title"><div><span>01</span><h2>Execution timeline</h2></div><em>LIVE POLL · 650MS</em></div>
            <div className="timeline">
              {(state?.events || []).map((entry, index) => (
                <article key={`${entry.at}-${index}`} className={entry.kind}>
                  <i>{entry.kind === "error" ? "!" : "✓"}</i>
                  <div><span>{time(entry.at)} · {entry.stage}</span><b>{entry.title}</b><p>{entry.detail}</p></div>
                </article>
              ))}
              {!state?.events?.length && <p className="empty">Waiting for execution evidence…</p>}
            </div>
          </section>

          <section className="evidence-card discovery-card">
            <div className="card-title"><div><span>02</span><h2>Live merchant discovery</h2></div><em className={state?.discovery ? "ok" : ""}>{state?.discovery ? `HTTP ${state.discovery.httpStatus}` : "PENDING"}</em></div>
            {state?.discovery ? <>
              <div className="source-proof">
                <div><small>SOURCE</small><a href={state.discovery.endpoint} target="_blank" rel="noreferrer">{state.discovery.source} ↗</a></div>
                <div><small>FETCHED</small><b>{time(state.discovery.fetchedAt)}</b></div>
                <div><small>CATALOGUE</small><b>{state.discovery.totalProducts} products</b></div>
                <div><small>EVALUATED</small><b>{state.discovery.evaluatedVariants} coffee variants</b></div>
                <div className="hash"><small>RESPONSE SHA-256</small><code>{state.discovery.sourceSha256}</code></div>
              </div>
              <div className="policy-proof"><small>{state.discovery.policy.name} · HARD GATES</small><b>{state.discovery.policy.hardGates.join(" · ")}</b><p>{state.discovery.policy.ranking}</p></div>
              <div className="candidate-list">
                {candidates.slice(0, 5).map((candidate) => (
                  <a href={candidate.productUrl} target="_blank" rel="noreferrer" className={candidate.id === selectedId ? "selected" : ""} key={candidate.id}>
                    <i>{candidate.id === selectedId ? "✓" : candidate.eligible ? "•" : "×"}</i>
                    <div><small>{candidate.merchant} · LIVE PRODUCT</small><b>{candidate.variantTitle}</b><p>{candidate.reasons.join(" · ")}</p></div>
                    <strong>S${candidate.deliveredTotalSgd.toFixed(2)}</strong>
                    <em>{candidate.id === selectedId ? "SELECTED" : candidate.eligible ? `SCORE ${candidate.score}` : "REJECTED"}</em>
                  </a>
                ))}
              </div>
            </> : <div className="pending-panel"><i>⌕</i><b>Merchant request has not completed</b><p>After the customer replies YES, this panel shows the real endpoint, response hash, candidates and selected product.</p></div>}
          </section>

          <section className="evidence-card proof-card">
            <div className="card-title"><div><span>03</span><h2>Payment and execution receipts</h2></div><em className={state?.payment ? "ok" : ""}>{state?.payment ? "CONFIRMED" : "PENDING"}</em></div>
            <div className="proof-grid">
              <div><small>PAYMENT</small><b>{state?.payment ? `S$${state.payment.payment.amountSgd.toFixed(2)} ${state.payment.payment.token}` : "Waiting for selection"}</b><p>Exact, single-use EIP-3009 authorization</p></div>
              <div><small>AVALANCHE</small>{state?.payment ? <a href={state.payment.settlement.explorerUrl} target="_blank" rel="noreferrer">{short(state.payment.settlement.transactionHash)} ↗</a> : <b>Pending Fuji receipt</b>}<p>{state?.payment?.settlement.network || "Chain ID 43113"}</p></div>
              <div><small>AWS REQUEST</small><b>{short(state?.aws?.requestId)}</b><p>{state?.aws ? `${state.aws.functionName} · ${state.aws.outcome}` : "Lambda validation pending"}</p></div>
              <div><small>MERCHANT HANDOFF</small>{state?.receipt?.cartUrl ? <a href={state.receipt.cartUrl} target="_blank" rel="noreferrer">Open real Shopify cart ↗</a> : <b>Pending</b>}<p>{state?.receipt?.note || "No physical order is claimed without a production payment rail."}</p></div>
            </div>
          </section>
        </div>

        <aside className="live-side">
          <section className="side-card mandate-card">
            <span>CUSTOMER MANDATE</span>
            <h2>{state?.request?.summary || "Waiting for an iMessage request"}</h2>
            <dl>
              <div><dt>Budget extracted</dt><dd>{state?.approval ? `≤ S$${state.approval.maxSpendSgd.toFixed(2)}` : "—"}</dd></div>
              <div><dt>Quantity</dt><dd>{state?.request?.quantity || "—"}</dd></div>
              <div><dt>Deliver to</dt><dd>{state?.request?.deliveryLocation || "—"}</dd></div>
              <div><dt>Authority</dt><dd className={state?.approval?.status === "approved" ? "green" : ""}>{state?.approval?.status || "waiting"}</dd></div>
            </dl>
          </section>

          <section className="side-card architecture-card">
            <div className="side-heading"><span>AWS + COMMERCE ARCHITECTURE</span><a href="/architecture" target="_blank">Full diagram ↗</a></div>
            <div className="architecture-flow">
              {architecture.map((node, index) => {
                const active = rank >= node.rank;
                return <div key={node.name} className={`${active ? "on" : ""} ${node.tone}`}>
                  <i>{active ? "✓" : index + 1}</i><p><b>{node.name}</b><small>{node.detail}</small></p><em>{node.tone}</em>
                </div>;
              })}
            </div>
            {state?.aws && <div className="aws-proof"><b>REAL AWS EXECUTION</b><span>Lambda</span><code>{state.aws.functionName}</code><span>DynamoDB</span><code>{state.aws.tableName}</code><span>CloudWatch</span><code>{state.aws.logGroupName}</code><span>Region</span><code>{state.aws.region}</code></div>}
          </section>

          <section className={`side-card receipt-card ${state?.receipt ? "ready" : ""}`}>
            <span>FINAL RECEIPT</span>
            {state?.receipt ? <><h2>{state.receipt.selectedProduct}</h2><p>{state.receipt.merchant} · S${state.receipt.amountSgd.toFixed(2)}</p><div><i>✓</i><b>Live discovery</b></div><div><i>✓</i><b>Fuji settlement</b></div><div><i>✓</i><b>AWS audit stored</b></div><small>{state.receipt.physicalOrderPlaced ? "Physical order confirmed" : "Real cart prepared · physical order not claimed"}</small></> : <p>The receipt appears only when every upstream proof is available.</p>}
          </section>
        </aside>
      </section>
    </main>
  );
}
