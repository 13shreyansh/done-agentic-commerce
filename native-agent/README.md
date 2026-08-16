# DONE native agent

This package is the Mac-side execution runtime behind the hosted DONE evidence console. It is deliberately separate from the Vercel app because native iMessage access, local wallet signing, and the authenticated AWS CLI must remain on the operator's Mac.

## What runs for real

1. Watches one explicitly selected private iMessage chat.
2. Uses OpenAI to turn the message into a bounded shopping request.
3. Requests a single explicit `YES` for the customer-stated SGD ceiling.
4. Fetches and fingerprints the live Shun Dat Shopify catalogue.
5. Applies the public BEST policy and selects an eligible result.
6. Settles the selected total as Fuji **test XSGD** through StraitsX x402.
7. Records sanitized evidence through AWS Lambda, DynamoDB, and CloudWatch.
8. Replies in Messages with the cart, Snowtrace proof, and AWS request ID.

The sponsor card is sandbox-only. The runtime prepares a real Shopify cart but never claims that a physical retail order was placed.

## Install

From the repository root:

```bash
npm run agent:install
npm run agent:check
```

Importing a wallet is optional for read-only checks, but required for a testnet x402 settlement:

```bash
cd native-agent
node ./bin/agentix.mjs wallet import
```

The encrypted keystore is written under `native-agent/.secrets/`, which is ignored by Git. Never place a private key, seed phrase, API key, Apple credential, card secret, or full address in source code or `.env`.

## Run the native iMessage flow

Start the Next.js interface in one terminal from the repository root:

```bash
npm run dev:next
```

Then start the native agent from a second terminal:

```bash
npm run agent:live -- --chat-rowid YOUR_PRIVATE_CHAT_ROW_ID --approval-limit 30
```

The process prompts separately for the OpenAI API key and local keystore password. Both remain only in that process. The live evidence console is available at `http://localhost:3000/live`.

## External prerequisites

- macOS Messages signed into the operator's demo Apple account.
- Full Disk Access and Automation permission for the terminal that runs the agent.
- An encrypted Fuji signing wallet with test AVAX and test XSGD.
- AWS CLI profile `agentix` authenticated to the event account.
- Deployed CloudFormation stack `done-phase4` from [`infra/aws/template.yaml`](infra/aws/template.yaml).

The web app can be deployed independently. Vercel never receives the local wallet, Messages database, OpenAI key, or AWS SSO credentials.
