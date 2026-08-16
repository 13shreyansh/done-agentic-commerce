"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const REQUEST =
  "Buy 20 sachets of sugar-free coffee for me. Deliver them to my saved SMU address. You may spend up to S$10 and complete the purchase without asking me any more questions.";

const PERMISSION =
  "I can handle that. Do I have permission to spend up to S$10 from your connected wallet for this purchase?";

type Stage = "compose" | "permission" | "authorized" | "ordered";

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
        <span>‹</span><b>12</b>
      </button>
      <div className="contact">
        <div className="contact-avatar">K</div>
        <div className="contact-name">Kopi Agent <span>›</span></div>
      </div>
      <button className="video-button" aria-label="Start video call">
        <span className="video-lens" />
      </button>
    </header>
  );
}

function TypingBubble() {
  return (
    <div className="row incoming-row typing-row" aria-label="Kopi Agent is typing">
      <div className="bubble incoming typing-bubble"><i /><i /><i /></div>
    </div>
  );
}

function ReceiptCard() {
  return (
    <article className="receipt-card" aria-label="Completed coffee order receipt">
      <div className="receipt-hero">
        <img
          src="https://www.shundat.com/cdn/shop/files/sg-11134207-821g7-mgxqmr4espvue1.jpg?v=1762870349&width=900"
          alt="Train Brand Kopi-O Kosong coffee sachets"
        />
        <div className="order-check" aria-hidden="true">✓</div>
      </div>
      <div className="receipt-body">
        <div className="ordered-label">ORDERED</div>
        <h2>Train Brand<br />Kopi-O Kosong</h2>
        <p className="product-detail">20 sugar-free coffee sachets</p>
        <div className="receipt-divider" />
        <dl>
          <div><dt>Paid</dt><dd>S$6.50</dd></div>
          <div><dt>Merchant</dt><dd>Shun Dat</dd></div>
          <div><dt>Deliver to</dt><dd>SMU · Saved address</dd></div>
          <div><dt>Order</dt><dd>#SD-1842</dd></div>
        </dl>
        <button className="view-receipt">View receipt <span>›</span></button>
      </div>
    </article>
  );
}

function Composer({ value, onChange, onSend, disabled }: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
}) {
  return (
    <div className="composer-area">
      <button className="plus-button" aria-label="Add attachment">+</button>
      <div className="composer">
        <textarea
          aria-label="iMessage"
          rows={1}
          value={value}
          placeholder="iMessage"
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
        />
        <button className="send-button" aria-label="Send message" onClick={onSend} disabled={disabled || !value.trim()}>↑</button>
      </div>
    </div>
  );
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("compose");
  const [draft, setDraft] = useState(REQUEST);
  const [typing, setTyping] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const timers = useRef<number[]>([]);
  const threadRef = useRef<HTMLDivElement>(null);

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
    setStage("compose");
    setDraft(REQUEST);
    setTyping(false);
    setAutoplay(false);
  }, [clearTimers]);

  const sendRequest = useCallback(() => {
    if (!draft.trim()) return;
    setDraft("");
    setTyping(true);
    later(() => {
      setTyping(false);
      setStage("permission");
      setDraft("Yes.");
    }, 1050);
  }, [draft, later]);

  const sendYes = useCallback(() => {
    if (!draft.trim()) return;
    setDraft("");
    setStage("authorized");
    later(() => setStage("ordered"), 2800);
  }, [draft, later]);

  const send = useCallback(() => {
    if (stage === "compose") sendRequest();
    if (stage === "permission") sendYes();
  }, [stage, sendRequest, sendYes]);

  const play = useCallback(() => {
    reset();
    setAutoplay(true);
    later(() => { setDraft(""); setTyping(true); }, 900);
    later(() => { setTyping(false); setStage("permission"); }, 2200);
    later(() => setStage("authorized"), 3900);
    later(() => setStage("ordered"), 7200);
  }, [later, reset]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("autoplay") === "1") play();
    return clearTimers;
  }, [clearTimers, play]);

  useEffect(() => {
    later(() => {
      threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
    }, 80);
  }, [stage, typing, later]);

  return (
    <main className="demo-shell">
      <section className="presentation-copy">
        <div className="eyebrow"><span /> AGENTIX PLAYGROUND</div>
        <h1>One message.<br />One permission.<br /><em>Done.</em></h1>
        <p>A seamless agent purchase, designed exactly as the customer experiences it.</p>
        <div className="demo-actions">
          <button className="play-demo" onClick={play}><span>▶</span> Play full demo</button>
          <button className="restart-demo" onClick={reset}>Restart</button>
        </div>
        <div className="step-line" aria-label="Demo flow">
          <span className={stage !== "compose" ? "complete" : "active"}>Request</span><i />
          <span className={stage === "permission" ? "active" : stage === "authorized" || stage === "ordered" ? "complete" : ""}>Permission</span><i />
          <span className={stage === "authorized" ? "active" : stage === "ordered" ? "complete" : ""}>Purchase</span><i />
          <span className={stage === "ordered" ? "active complete" : ""}>Receipt</span>
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
              {stage !== "compose" && <div className="row outgoing-row request-row"><div className="bubble outgoing">{REQUEST}</div></div>}
              {typing && <TypingBubble />}
              {(stage === "permission" || stage === "authorized" || stage === "ordered") && (
                <div className="row incoming-row permission-row"><div className="bubble incoming">{PERMISSION}</div></div>
              )}
              {(stage === "authorized" || stage === "ordered") && (
                <div className="row outgoing-row yes-row"><div className="bubble outgoing">Yes.</div><div className="delivered">Delivered</div></div>
              )}
              {stage === "ordered" && (
                <><div className="later-separator"><span>10 minutes later</span></div><div className="row incoming-row receipt-row"><ReceiptCard /></div></>
              )}
              {stage === "authorized" && <div className="quiet-working" aria-label="The agent is completing the purchase" />}
            </div>
            <Composer value={autoplay ? "" : draft} onChange={setDraft} onSend={send} disabled={autoplay || stage === "authorized" || stage === "ordered"} />
            <div className="home-indicator" />
          </div>
        </div>
      </section>
    </main>
  );
}
