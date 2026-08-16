import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the complete DONE commerce demo", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /DONE — Don’t buy products\. Buy outcomes\./i);
  assert.match(html, /LIVE DEMO/);
  assert.match(html, /simulated experience/i);
  assert.match(html, /WHY DONE WINS/);
  assert.match(html, /One-minute pitch/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/);
});

test("server-renders the truthful judge architecture", async () => {
  const response = await render("/architecture");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /DONE Architecture/i);
  assert.match(html, /AWS Lambda/);
  assert.match(html, /Amazon DynamoDB/);
  assert.match(html, /StraitsX x402/);
  assert.match(html, /Native iMessage agent/i);
  assert.match(html, /Shopify catalogue fetch/i);
  assert.match(html, /SANDBOX/);
  assert.match(html, /What never leaves the user/);
});
