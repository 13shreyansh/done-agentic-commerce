"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OrderResult, PurchaseCommand } from "@/lib/commerce/types";
import type { PaymentProof } from "@/lib/payments/types";
import "./run.css";

const MAX_SPEND = 10;
const DELIVERY = "SMU · Saved office address";
const REQUEST = "20 sugar-free kopi sachets for the office";

const stages = [
  { key: "mandate", label: "Understanding request", eyebrow: "01 · INTENT" },
  { key: "search", label: "Searching Singapore merchants", eyebrow: "02 · DISCOVERY" },
  { key: "compare", label: "Applying purchase policy", eyebrow: "03 · DECISION" },
  { key: "payment", label: "Authorizing XSGD payment", eyebrow: "04 · PAYMENT" },
  { key: "checkout", label: "Completing merchant checkout", eyebrow: "05 · EXECUTION" },
  { key: "complete", label: "Order completed", eyebrow: "DONE" },
] as const;

const catalog = [
  { name: "Train Brand Penang Coffee O", merchant: "Shun Dat", item: 6.5, delivery: 3.5, total: 10, rating: 4.8, sugarFree: true, stock: true },
  { name: "Gold Kili Instant Black Coffee", merchant: "Local Pantry", item: 7.1, delivery: 4.2, total: 11.3, rating: 4.5, sugarFree: true, stock: true },
  { name: "OldTown 3-in-1 Classic", merchant: "Kopitiam Market", item: 6.2, delivery: 3.1, total: 9.3, rating: 4.7, sugarFree: false, stock: true },
];

const stageTimes = [350, 2500, 5300, 7800, 10400, 12900];

function money(value: number) {
  return `S$${value.toFixed(2)}`;
}

function short(value?: string) {
  if (!value) return "0x701c…E032A";
  return `${value.slice(0, 10)}…${value.slice(-7)}`;
}

function StatusPill({ active, complete }: { active: boolean; complete: boolean }) {
  return <span className={`run-status ${active ? "active" : ""} ${complete ? "complete" : ""}`}>{complete ? "✓" : active ? "●" : ""}</span>;
}

export default function RunPage() {
  const [stage, setStage] = useState(-1);
  const [runKey, setRunKey] = useState(0);
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [proof, setProof] = useState<PaymentProof | null>(null);
  const timers = useRef<number[]>([]);

  const start = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setStage(-1);
    setOrder(null);
    setProof(null);
    setRunKey((value) => value + 1);
  }, []);

  useEffect(() => {
    const idempotencyKey = `done-video-${Date.now()}-${runKey}`;
    const command: PurchaseCommand = {
      intent: {
        rawRequest: REQUEST,
        quantity: 20,
        noAddedSugar: true,
        deliveryAddressLabel: DELIVERY,
        deliveryRegion: "SG",
        maxTotalSgd: MAX_SPEND,
      },
      approval: { approved: true, approvalText: "Yes", maxSpendSgd: MAX_SPEND },
      idempotencyKey,
    };

    void fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    }).then((response) => response.json()).then((body: OrderResult) => setOrder(body)).catch(() => undefined);

    void fetch(`/phase3-proof.json?t=${Date.now()}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((body: PaymentProof) => setProof(body))
      .catch(() => undefined);

    stageTimes.forEach((delay, index) => {
      timers.current.push(window.setTimeout(() => setStage(index), delay));
    });
    return () => timers.current.forEach(window.clearTimeout);
  }, [runKey]);

  const terminal = useMemo(() => [
    { at: 0, kind: "command", text: "$ done execute --mandate msg_9F2C" },
    { at: 0, kind: "muted", text: "Reading customer intent and saved delivery profile…" },
    { at: 0, kind: "success", text: "✓ Explicit approval verified: one purchase ≤ S$10.00" },
    { at: 1, kind: "command", text: "$ merchant.search --region SG --query \"sugar-free kopi ×20\"" },
    { at: 1, kind: "muted", text: "Connecting to merchant catalogue adapters…" },
    { at: 1, kind: "success", text: "✓ 3 comparable products resolved with delivery quotes" },
    { at: 2, kind: "command", text: "$ policy evaluate --rules BEST-v1.1" },
    { at: 2, kind: "success", text: "✓ 1 eligible outcome · Shun Dat selected at S$10.00" },
    { at: 3, kind: "command", text: "$ pay POST /x402/issue-card" },
    { at: 3, kind: "warn", text: "← HTTP 402 PAYMENT-REQUIRED · exact XSGD terms received" },
    { at: 3, kind: "success", text: `✓ Bound authorization signed · ${short(proof?.payment.payer)}` },
    { at: 3, kind: "success", text: `✓ Test XSGD settled on Avalanche Fuji · ${short(proof?.settlement.transactionHash)}` },
    { at: 4, kind: "command", text: "$ checkout confirm --merchant shun-dat --single-use" },
    { at: 4, kind: "success", text: `✓ Merchant accepted order ${order?.order.id ?? "SD-42C91A"}` },
    { at: 5, kind: "done", text: "DONE · Receipt returned to the conversation" },
  ], [order, proof]);

  const current = stages[Math.max(stage, 0)];
  const selected = order?.selected.product;
  const orderId = order?.order.id ?? "SD-42C91A";

  return (
    <main className="run-shell">
      <header className="run-header">
        <div className="run-brand"><span>D</span><div><b>DONE Agent</b><small>Autonomous commerce execution</small></div></div>
        <div className="run-live"><i /> MERCHANT SANDBOX · FUJI TESTNET</div>
        <button onClick={start}>Restart run ↻</button>
      </header>

      <section className="run-progress">
        {stages.map((item, index) => (
          <div key={item.key} className={index === stage ? "active" : index < stage ? "complete" : ""}>
            <StatusPill active={index === stage} complete={index < stage || stage === stages.length - 1} />
            <span>{item.label}</span>
          </div>
        ))}
      </section>

      <section className="run-grid">
        <aside className="terminal-panel">
          <div className="terminal-top"><div><i /><i /><i /></div><span>done-agent — execution log</span><em>zsh</em></div>
          <div className="terminal-body">
            <div className="terminal-intro"><span>{current.eyebrow}</span><b>{current.label}</b></div>
            {terminal.filter((line) => line.at <= stage).map((line, index) => (
              <p className={line.kind} key={`${line.text}-${index}`}>{line.text}</p>
            ))}
            {stage < 5 && <div className="terminal-cursor"><span>›</span><i /></div>}
          </div>
        </aside>

        <section className="workspace-panel">
          <div className="workspace-bar">
            <div><span>←</span><span>→</span><span>↻</span></div>
            <p><i /> agent.done.local/run/{stages[Math.max(stage, 0)].key}</p>
            <b>•••</b>
          </div>

          {stage <= 0 && (
            <div className="workspace-content mandate-view">
              <div className="view-kicker">CUSTOMER MANDATE</div>
              <h1>Turn a message into a bounded purchase.</h1>
              <div className="mandate-quote">“Buy 20 sachets of sugar-free kopi for the office.”</div>
              <div className="mandate-grid">
                <div><span>Budget</span><b>≤ S$10.00</b></div>
                <div><span>Permission</span><b>One purchase</b></div>
                <div><span>Deliver to</span><b>Saved SMU address</b></div>
                <div><span>Approval</span><b className="green">Explicit “Yes” ✓</b></div>
              </div>
            </div>
          )}

          {stage === 1 && (
            <div className="workspace-content search-view">
              <div className="search-heading"><div><span>MERCHANT DISCOVERY</span><h2>Comparing delivered outcomes</h2></div><em><i /> 3 sources live</em></div>
              <div className="search-query">⌕&nbsp;&nbsp; sugar-free kopi sachets ×20 · deliver to Singapore</div>
              <div className="product-grid">
                {catalog.map((item, index) => (
                  <article key={item.name} style={{ animationDelay: `${index * 180}ms` }}>
                    <div className="coffee-art"><span>{index === 0 ? "KOPI O" : index === 1 ? "BLACK" : "3 IN 1"}</span><i>20</i></div>
                    <small>{item.merchant}</small><h3>{item.name}</h3>
                    <p>{item.sugarFree ? "No added sugar" : "Contains added sugar"} · In stock</p>
                    <div><b>{money(item.total)} delivered</b><em>★ {item.rating}</em></div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {stage === 2 && (
            <div className="workspace-content compare-view">
              <div className="view-kicker">POLICY ENGINE · BEST-v1.1</div>
              <h2>Choosing the best eligible outcome</h2>
              <div className="comparison-table">
                {catalog.map((item, index) => {
                  const eligible = item.total <= MAX_SPEND && item.sugarFree;
                  return <div className={index === 0 ? "winner" : ""} key={item.name}>
                    <span>{index === 0 ? "✓" : "×"}</span>
                    <p><b>{item.name}</b><small>{item.merchant}</small></p>
                    <em>{money(item.total)}</em>
                    <strong>{index === 0 ? "SELECTED" : eligible ? "ELIGIBLE" : item.total > MAX_SPEND ? "OVER BUDGET" : "ADDED SUGAR"}</strong>
                  </div>;
                })}
              </div>
              <div className="decision-note"><span>WHY THIS WON</span><p>Matches the sugar-free constraint, includes 20 sachets, is in stock in Singapore, and lands exactly within the approved S$10 ceiling.</p></div>
            </div>
          )}

          {stage === 3 && (
            <div className="workspace-content payment-view">
              <div className="view-kicker">X402 · STRAITSX · AVALANCHE</div>
              <h2>Paying without exposing the wallet.</h2>
              <div className="payment-flow">
                <div className="pay-node"><span>1</span><p><b>Payment required</b><small>HTTP 402 · exact S$10 terms</small></p><em>RECEIVED</em></div>
                <i />
                <div className="pay-node"><span>2</span><p><b>Mandate authorized</b><small>One use · one merchant · S$10 max</small></p><em>BOUND</em></div>
                <i />
                <div className="pay-node"><span>3</span><p><b>XSGD settled</b><small>Avalanche Fuji C-Chain</small></p><em>CONFIRMED</em></div>
              </div>
              <div className="transaction-card">
                <div><span>FROM</span><b>{short(proof?.payment.payer)}</b></div>
                <div><span>AMOUNT</span><b>{money(proof?.payment.amountSgd ?? 10)} test XSGD</b></div>
                <div><span>TRANSACTION</span><b>{short(proof?.settlement.transactionHash)}</b></div>
                <div><span>NETWORK</span><b>Avalanche Fuji · 43113</b></div>
              </div>
            </div>
          )}

          {stage === 4 && (
            <div className="workspace-content checkout-view">
              <div className="checkout-browser">
                <header><b>SHUN DAT</b><span>Secure merchant checkout · SANDBOX</span></header>
                <div className="checkout-product"><div className="coffee-art"><span>KOPI O</span><i>20</i></div><div><small>ORDERING</small><h2>Train Brand Penang Coffee O</h2><p>20 no-added-sugar sachets</p></div></div>
                <dl><div><dt>Items</dt><dd>S$6.50</dd></div><div><dt>Delivery to SMU</dt><dd>S$3.50</dd></div><div><dt>Total</dt><dd>S$10.00</dd></div></dl>
                <div className="checkout-action"><span><i /> Payment authorized</span><button>Placing order…</button></div>
              </div>
            </div>
          )}

          {stage >= 5 && (
            <div className="workspace-content complete-view">
              <div className="success-mark">✓</div>
              <div className="view-kicker">MERCHANT SANDBOX ORDER COMPLETED</div>
              <h1>Done — without another question.</h1>
              <p>{selected?.name ?? "Train Brand Penang Coffee O"} is being delivered to the saved SMU address.</p>
              <div className="receipt-summary">
                <div><span>Order</span><b>#{orderId}</b></div>
                <div><span>Total paid</span><b>S$10.00 XSGD</b></div>
                <div><span>Merchant</span><b>{selected?.merchant ?? "Shun Dat"}</b></div>
                <div><span>Policy</span><b>Single-use mandate ✓</b></div>
              </div>
              <div className="returned"><i /> Receipt returned to iMessage</div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
