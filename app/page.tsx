"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OrderResult, PurchaseCommand } from "@/lib/commerce/types";
import { isPaymentProof, type PaymentProof } from "@/lib/payments/types";

const REQUEST =
  "Buy 20 sachets of sugar-free kopi for the office. Deliver them to my saved SMU address. You may spend up to S$10 and complete one purchase without asking again.";

const PERMISSION = "Do I have your permission to spend up to S$10 from your XSGD wallet?";
const APPROVAL = "Yes";

type Stage = "compose" | "asking" | "permission" | "ordering" | "ordered";

function StatusBar() {
  return (
    <div className="status-bar" aria-hidden="true">
      <span className="status-time">9:41</span>
      <span className="dynamic-island" />
      <div className="status-icons">
        <span className="signal"><i /><i /><i /><i /></span>
        <span className="wifi">⌁</span>
        <span className="battery"><i /></span>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="messages-header">
      <button className="back-button" aria-label="Back to conversations">
        <span>‹</span><b>9</b>
      </button>
      <div className="contact">
        <div className="contact-avatar">D</div>
        <div className="contact-name">DONE <span>›</span></div>
      </div>
      <button className="video-button" aria-label="Start video call">
        <span className="video-lens" />
      </button>
    </header>
  );
}

function TypingBubble() {
  return (
    <div className="row incoming-row typing-row" aria-label="DONE is typing">
      <div className="bubble incoming typing-bubble"><i /><i /><i /></div>
    </div>
  );
}

function PermissionBubble() {
  return (
    <div className="row incoming-row permission-row">
      <div className="bubble incoming permission-bubble">
        <b>I can do that.</b>
        {PERMISSION}
      </div>
    </div>
  );
}

const formatSgd = (value: number) => `S$${value.toFixed(2)}`;

function ReceiptCard({ result, paymentProof, onProof }: {
  result: OrderResult;
  paymentProof: PaymentProof | null;
  onProof: () => void;
}) {
  const product = result.selected.product;
  return (
    <article className="receipt-card" aria-label="Completed coffee order receipt">
      <div className="receipt-hero">
        <img
          src={product.imageUrl}
          alt={product.name}
        />
        <div className="order-check" aria-hidden="true">✓</div>
        <span className="receipt-mode">{paymentProof ? "TEST XSGD · MERCHANT SANDBOX" : "MERCHANT SANDBOX"}</span>
      </div>
      <div className="receipt-body">
        <div className="ordered-label">ORDERED{paymentProof ? " · PAYMENT PROVED" : ""}</div>
        <h2>{product.name}</h2>
        <p className="product-detail">{product.description}</p>
        <div className="receipt-divider" />
        <dl>
          <div><dt>Item</dt><dd>{formatSgd(result.order.itemPriceSgd)}</dd></div>
          <div><dt>Demo delivery quote</dt><dd>{formatSgd(result.order.deliveryPriceSgd)}</dd></div>
          <div className="receipt-total"><dt>Total</dt><dd>{formatSgd(result.order.totalSgd)}</dd></div>
          {paymentProof && <div><dt>Payment rail</dt><dd>{formatSgd(paymentProof.payment.amountSgd)} test XSGD · Fuji</dd></div>}
          <div><dt>Deliver to</dt><dd>{result.order.deliveryAddressLabel}</dd></div>
          <div><dt>Order</dt><dd>#{result.order.id}</dd></div>
        </dl>
        <button className="view-receipt" onClick={onProof}>View order proof <span>›</span></button>
      </div>
    </article>
  );
}

type ReplayStatus = "idle" | "checking" | "confirmed" | "error";

const compact = (value: string, lead = 8, tail = 6) => `${value.slice(0, lead)}…${value.slice(-tail)}`;

function PaymentEvidence({ proof }: { proof: PaymentProof | null }) {
  if (!proof) {
    return (
      <section className="payment-evidence pending">
        <div className="payment-title"><div><span>X402 PAYMENT RAIL</span><b>Secure activation pending</b></div><em>READY</em></div>
        <p>The order remains a merchant sandbox result until the one-time Fuji test-XSGD settlement is activated from the encrypted local wallet.</p>
      </section>
    );
  }

  return (
    <section className="payment-evidence">
      <div className="payment-title">
        <div><span>LIVE X402 PAYMENT PROOF</span><b>{formatSgd(proof.payment.amountSgd)} test XSGD · Avalanche Fuji</b></div>
        <em>CONFIRMED</em>
      </div>
      <div className="payment-steps">
        <div><i>1</i><p><b>HTTP request challenged</b><span>{proof.http.initialStatus} PAYMENT-REQUIRED · exact amount</span></p><em>Live</em></div>
        <div><i>2</i><p><b>Bound authorization signed</b><span>EIP-3009 · key stayed outside the browser</span></p><em>Local</em></div>
        <div><i>3</i><p><b>XSGD settled on Avalanche</b><span>Block {proof.settlement.blockNumber} · Transfer event verified</span></p><em>On-chain</em></div>
        <div><i>4</i><p><b>Sandbox card capability returned</b><span>Non-spendable card · opaque reference protected</span></p><em>Issued</em></div>
      </div>
      <div className="payment-reference">
        <div><span>Settlement</span><b>{compact(proof.settlement.transactionHash, 12, 8)}</b></div>
        <a href={proof.settlement.explorerUrl} target="_blank" rel="noreferrer">Open on Snowtrace ↗</a>
      </div>
      <p className="mainnet-note"><b>Mainnet readiness:</b> {proof.mainnet.xsgdBalance} XSGD verified in the wallet; no mainnet funds were spent.</p>
    </section>
  );
}

function ProofSheet({ result, paymentProof, replayStatus, onReplay, onClose }: {
  result: OrderResult;
  paymentProof: PaymentProof | null;
  replayStatus: ReplayStatus;
  onReplay: () => void;
  onClose: () => void;
}) {
  const proofRows = [
    { label: "Engine", value: `${result.engineVersion} · ${result.candidates.length} candidates`, state: "Live", tone: "green" },
    { label: "Policy", value: result.policy.version, state: "Applied", tone: "green" },
    { label: "Authority", value: `${formatSgd(result.mandate.maxSpendSgd)} · one use · ${result.mandate.merchantScope}`, state: "Bound", tone: "green" },
    {
      label: "Duplicate safety",
      value: result.idempotencyKey.slice(0, 22),
      state: replayStatus === "confirmed" || result.replayed ? "Replay blocked" : "Stored",
      tone: replayStatus === "confirmed" || result.replayed ? "green" : "blue",
    },
    {
      label: "x402 / XSGD",
      value: paymentProof ? `${formatSgd(paymentProof.payment.amountSgd)} test XSGD · HTTP 402` : "Secure sandbox activation pending",
      state: paymentProof ? "Settled" : "Ready",
      tone: paymentProof ? "green" : "amber",
    },
    {
      label: "Avalanche",
      value: paymentProof ? `Fuji · block ${paymentProof.settlement.blockNumber}` : "Fuji C-Chain · 43113",
      state: paymentProof ? "Verified" : "Testnet",
      tone: paymentProof ? "green" : "blue",
    },
  ];

  return (
    <div className="proof-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="proof-sheet" role="dialog" aria-modal="true" aria-labelledby="proof-title">
        <div className="proof-header">
          <div><span>PHASE 3 · PAYMENT {paymentProof ? "CONNECTED" : "READY"}</span><h2 id="proof-title">Order proof</h2></div>
          <button onClick={onClose} aria-label="Close order proof">×</button>
        </div>
        <p className="proof-intro">The conversation stayed simple. This panel exposes the real local decision, mandate, and merchant-sandbox evidence behind it.</p>
        <div className="proof-rows">
          {proofRows.map((row) => (
            <div className="proof-row" key={row.label}>
              <span>{row.label}</span><b>{row.value}</b><em className={row.tone}>{row.state}</em>
            </div>
          ))}
        </div>
        <div className="decision-card">
          <div className="decision-header">
            <div><span>WHY THIS WON</span><b>{result.selected.product.name}</b></div>
            <a href="/BEST.md" target="_blank" rel="noreferrer">Open BEST.md ↗</a>
          </div>
          <div className="candidate-list">
            {result.candidates.map((candidate) => {
              const selected = candidate.product.id === result.selected.product.id;
              return (
                <div className={`candidate-row${selected ? " selected" : ""}`} key={candidate.product.id}>
                  <div><b>{candidate.product.name}</b><span>{candidate.product.merchant}</span></div>
                  <strong>{formatSgd(candidate.deliveredTotalSgd)}</strong>
                  <em className={candidate.eligible ? "eligible" : "rejected"}>{selected ? "Selected" : candidate.eligible ? `Score ${candidate.score}` : "Rejected"}</em>
                  <p>{candidate.reasons.join(" · ")}</p>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mandate-card">
          <span>APPROVED MANDATE</span>
          <p>One order from {result.mandate.merchantScope} · Total ≤ {formatSgd(result.mandate.maxSpendSgd)} · {result.mandate.deliveryAddressLabel} · Expires after use</p>
        </div>
        <PaymentEvidence proof={paymentProof} />
        <button className={`replay-test ${replayStatus}`} onClick={onReplay} disabled={replayStatus === "checking" || replayStatus === "confirmed"}>
          {replayStatus === "checking" && "Replaying the same request…"}
          {replayStatus === "confirmed" && `✓ Duplicate blocked — ${result.order.id} returned`}
          {replayStatus === "error" && "Retry duplicate-protection test"}
          {replayStatus === "idle" && "Test duplicate protection"}
        </button>
        <p className="proof-footnote">The merchant order is a clearly labeled sandbox result. The x402 evidence is {paymentProof ? "a live StraitsX sponsor-sandbox settlement using Fuji test XSGD" : "not yet settled"}; no real card purchase or mainnet payment is claimed.</p>
      </section>
    </div>
  );
}

function Composer({ value, onChange, onSend, disabled, placeholder }: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder: string;
}) {
  return (
    <div className="composer-area">
      <button className="plus-button" aria-label="Add attachment">+</button>
      <div className="composer">
        <textarea
          aria-label="iMessage"
          rows={1}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
        />
        {!value.trim() && <span className="audio-wave" aria-hidden="true"><i /><i /><i /><i /><i /></span>}
        {!!value.trim() && <button className="send-button" aria-label="Send message" onClick={onSend} disabled={disabled}>↑</button>}
      </div>
    </div>
  );
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("compose");
  const [draft, setDraft] = useState("");
  const [requestText, setRequestText] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [autoplay, setAutoplay] = useState(false);
  const [nativeDevice, setNativeDevice] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [approvalError, setApprovalError] = useState("");
  const [orderError, setOrderError] = useState("");
  const [replayStatus, setReplayStatus] = useState<ReplayStatus>("idle");
  const [paymentProof, setPaymentProof] = useState<PaymentProof | null>(null);
  const timers = useRef<number[]>([]);
  const threadRef = useRef<HTMLDivElement>(null);
  const idempotencyKeyRef = useRef("");
  const commandRef = useRef<PurchaseCommand | null>(null);
  const runRef = useRef(0);

  const loadPaymentProof = useCallback(async () => {
    try {
      const response = await fetch(`/phase3-proof.json?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const body: unknown = await response.json();
      if (isPaymentProof(body)) setPaymentProof(body);
    } catch {
      // A missing proof is an intentional pre-activation state, not a customer-facing failure.
    }
  }, []);

  const later = useCallback((fn: () => void, delay: number) => {
    const timer = window.setTimeout(fn, delay);
    timers.current.push(timer);
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    runRef.current += 1;
    setStage("compose");
    setDraft("");
    setRequestText("");
    setAnswerText("");
    setAutoplay(false);
    setProofOpen(false);
    setOrderResult(null);
    setApprovalError("");
    setOrderError("");
    setReplayStatus("idle");
    idempotencyKeyRef.current = "";
    commandRef.current = null;
  }, [clearTimers]);

  const beginRequest = useCallback((text: string) => {
    runRef.current += 1;
    idempotencyKeyRef.current = `done-${window.crypto.randomUUID()}`;
    setRequestText(text);
    setDraft("");
    setApprovalError("");
    setOrderError("");
    setStage("asking");
    later(() => setStage("permission"), 700);
  }, [later]);

  const beginOrder = useCallback(async (text = APPROVAL, rawRequest = REQUEST) => {
    if (!/\b(yes|approve|approved|proceed|go ahead)\b/i.test(text)) {
      setApprovalError("Please reply Yes to approve the S$10 ceiling, or restart to cancel.");
      return;
    }

    const run = runRef.current;
    const idempotencyKey = idempotencyKeyRef.current || `done-${window.crypto.randomUUID()}`;
    idempotencyKeyRef.current = idempotencyKey;
    const command: PurchaseCommand = {
      intent: {
        rawRequest,
        quantity: 20,
        noAddedSugar: true,
        deliveryAddressLabel: "SMU · Saved address",
        deliveryRegion: "SG",
        maxTotalSgd: 10,
      },
      approval: {
        approved: true,
        approvalText: text,
        maxSpendSgd: 10,
      },
      idempotencyKey,
    };
    commandRef.current = command;
    setAnswerText(text);
    setDraft("");
    setApprovalError("");
    setOrderError("");
    setStage("ordering");

    try {
      const responsePromise = fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      const [response] = await Promise.all([
        responsePromise,
        new Promise((resolve) => window.setTimeout(resolve, 900)),
      ]);
      const body = await response.json() as OrderResult | { error: string };
      if (!response.ok || "error" in body) {
        throw new Error("error" in body ? body.error : "The local commerce engine rejected the order");
      }
      if (run !== runRef.current) return;
      setOrderResult(body);
      setStage("ordered");
    } catch (error) {
      if (run !== runRef.current) return;
      setOrderError(error instanceof Error ? error.message : "The local commerce engine could not create the order");
      setStage("permission");
    }
  }, []);

  const replayOrder = useCallback(async () => {
    if (!commandRef.current) return;
    setReplayStatus("checking");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(commandRef.current),
      });
      const body = await response.json() as OrderResult | { error: string };
      if (!response.ok || "error" in body || !body.replayed) throw new Error("Replay was not blocked");
      setOrderResult(body);
      setReplayStatus("confirmed");
    } catch {
      setReplayStatus("error");
    }
  }, []);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    if (stage === "compose") beginRequest(text);
    if (stage === "permission") void beginOrder(text, requestText || REQUEST);
  }, [beginOrder, beginRequest, draft, requestText, stage]);

  const play = useCallback(() => {
    reset();
    setAutoplay(true);
    runRef.current += 1;
    idempotencyKeyRef.current = `done-${window.crypto.randomUUID()}`;
    later(() => {
      setRequestText(REQUEST);
      setStage("asking");
    }, 500);
    later(() => setStage("permission"), 1250);
    later(() => void beginOrder(APPROVAL, REQUEST), 2600);
  }, [beginOrder, later, reset]);

  useEffect(() => {
    const onAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const narrowTouchDevice = navigator.maxTouchPoints > 1 && window.innerWidth < 700;
    const frame = window.requestAnimationFrame(() => {
      setNativeDevice(onAppleMobile || narrowTouchDevice);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const autoplayTimer = params.get("autoplay") === "1"
      ? window.setTimeout(play, 0)
      : undefined;
    return () => {
      if (autoplayTimer !== undefined) window.clearTimeout(autoplayTimer);
      clearTimers();
    };
  }, [clearTimers, play]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPaymentProof(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPaymentProof]);

  useEffect(() => {
    later(() => threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" }), 80);
  }, [stage, later]);

  useEffect(() => {
    if (!proofOpen) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setProofOpen(false);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loadPaymentProof, proofOpen]);

  const flowPosition = stage === "compose" || stage === "asking"
    ? 0
    : stage === "permission"
      ? 1
      : 2;
  const flowClass = (index: number) => flowPosition > index ? "complete" : flowPosition === index ? "active" : "";
  const composerDisabled = autoplay || stage === "asking" || stage === "ordering" || stage === "ordered";

  return (
    <main className={`demo-shell${nativeDevice ? " native-device" : ""}`}>
      <section className="presentation-copy">
        <div className="eyebrow"><span /> PHASE 3 · X402 {paymentProof ? "CONNECTED" : "READY"}</div>
        <h1>Ask.<br />Approve.<br /><em>Done.</em></h1>
        <p>DONE asks once for a spending ceiling, then completes the outcome without interrupting you again.</p>
        <div className="demo-actions">
          <button className="play-demo" onClick={play}><span>▶</span> Play full demo</button>
          <button className="restart-demo" onClick={reset}>Restart</button>
        </div>
        <div className="step-line" aria-label="Demo flow">
          <span className={flowClass(0)}>Request</span><i />
          <span className={flowClass(1)}>Approve</span><i />
          <span className={flowClass(2)}>Ordered</span>
        </div>
        <div className="checkpoint-card">
          <span>PHASE 3 CHECKPOINT</span>
          <div><i>01</i><p><b>Real HTTP 402</b>The sponsor endpoint returns machine-readable payment terms.</p></div>
          <div><i>02</i><p><b>Local bounded signing</b>Only exact Fuji test XSGD terms can be authorized.</p></div>
          <div><i>03</i><p><b>On-chain proof</b>A verified Transfer event and sandbox card receipt complete the rail.</p></div>
        </div>
      </section>

      <section className="phone-stage" aria-label="Interactive iPhone Messages simulation">
        <div className="phone-shadow" />
        <div className="iphone">
          <div className="phone-screen">
            <StatusBar />
            <Header />
            <div className="thread" ref={threadRef}>
              <div className="conversation-date">Today 9:41 AM</div>
              {stage !== "compose" && (
                <div className="row outgoing-row request-row"><div className="bubble outgoing">{requestText || REQUEST}</div></div>
              )}
              {stage === "asking" && <TypingBubble />}
              {(stage === "permission" || stage === "ordering" || stage === "ordered") && <PermissionBubble />}
              {(approvalError || orderError) && <div className="engine-error">{approvalError || orderError}</div>}
              {(stage === "ordering" || stage === "ordered") && (
                <div className="row outgoing-row yes-row"><div className="bubble outgoing">{answerText || APPROVAL}</div><div className="delivered">Delivered</div></div>
              )}
              {stage === "ordering" && <TypingBubble />}
              {stage === "ordered" && orderResult && (
                <div className="row incoming-row receipt-row"><ReceiptCard result={orderResult} paymentProof={paymentProof} onProof={() => {
                  void loadPaymentProof();
                  setProofOpen(true);
                }} /></div>
              )}
            </div>
            <Composer
              value={autoplay ? "" : draft}
              onChange={setDraft}
              onSend={send}
              disabled={composerDisabled}
              placeholder={stage === "permission" ? "Reply Yes to approve" : "iMessage"}
            />
            <div className="home-indicator" />
          </div>
        </div>
      </section>
      {proofOpen && orderResult && (
        <ProofSheet
          result={orderResult}
          paymentProof={paymentProof}
          replayStatus={replayStatus}
          onReplay={() => void replayOrder()}
          onClose={() => setProofOpen(false)}
        />
      )}
    </main>
  );
}
