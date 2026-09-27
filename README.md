# WikiSeed 🌱 — where small languages grow

Bounties for Wikipedia articles in under-served languages (Faroese, Wolof, Quechua, Tamazight, Gaelic…), judged by
GenLayer's AI validators and paid on-chain. No moderators, no oracle.

- **Network:** GenLayer **Studionet** (chain `61999`, RPC `https://studio.genlayer.com/api`)
- **Contract:** [`0xfD6BE144C962a5760b6F675FCCf72a721E247FF5`](https://explorer-studio.genlayer.com/address/0xfD6BE144C962a5760b6F675FCCf72a721E247FF5)
- **Frontend:** Next.js 16 · GSAP (SplitText, ScrollTrigger, CustomEase) · Lenis · wagmi v3 wallet adapter · genlayer-js

## How it works

| Step | Contract method | GenLayer feature |
|---|---|---|
| Sponsor locks GEN on a topic + language | `create_bounty` (payable) | `gl.message.value` |
| Writer links Wikipedia account ↔ wallet | `link_wiki_account` | `gl.nondet.web.get` + `strict_eq` (User page must contain the wallet and be saved by that user) |
| Writer claims with a revision id | `submit_claim` | MediaWiki API facts (creator, created date, words, refs) + each validator's own LLM judges language, topic, machine-translation risk and sources — `run_nondet_unsafe` with exact fact matching and a ±1 tolerance band on the verdict |
| After the survival window | `finalize` (anyone) | validators re-read the page: still exists, not a redirect, ≥ 60 % of claimed words |
| Pull payment | `withdraw` | `emit_transfer` to the EOA |
| Refunds | `cancel_bounty` (sponsor) / `expire_bounty` (anyone after deadline) | |

Views: `get_bounties`, `get_bounty`, `get_attempts`, `get_account`, `get_stats`.

## Project layout

```
contracts/wiki_seed.py        Intelligent Contract (Python, GenVM)
tests/direct/                 direct-mode tests (gltest, mocked web + LLM)
scripts/deploy.mjs            deploy to Studionet, writes .env.local
scripts/seed.mjs              seed demo bounties
scripts/smoke.mjs             smoke test against the deployed contract
app/ components/ hooks/ lib/  Next.js frontend
```

## Contract dev

```bash
pip install genvm-linter genlayer-test
PYTHONUTF8=1 genvm-lint check contracts/wiki_seed.py
PYTHONUTF8=1 python -m pytest tests/direct -q
```

## Deploy the contract to Studionet

```bash
cp .env.example .env          # put DEPLOYER_PRIVATE_KEY (testnet key only)
npm install
npm run deploy                # prints the address and writes .env.local
node scripts/seed.mjs         # optional demo bounties
```

You can also open [studio.genlayer.com](https://studio.genlayer.com), paste `contracts/wiki_seed.py`, deploy it and call
its methods from the Studio UI.

## Run / deploy the frontend

```bash
npm run dev                   # http://localhost:3000
```

Vercel: import the repo, framework **Next.js**, add env var `NEXT_PUBLIC_CONTRACT_ADDRESS` (optional — the deployed
address above is the default). No server code, no secrets needed in Vercel.

## Using the dapp

1. **Connect wallet** (MetaMask, Rabby, any EIP-6963 wallet). It adds/switches to Studionet automatically.
2. Account panel → **💧 Faucet** for free test GEN.
3. Put your wallet address on your Wikipedia User page (meta.wikimedia.org, test.wikipedia.org or en.wikipedia.org),
   save it yourself, then **Verify & link**.
4. Write the article on the bounty's wiki, paste the revision permalink (`…?oldid=123`) and **Submit for judgement**.
5. After the survival window anyone can **Finalize**; then **Withdraw** your reward.

For a quick end-to-end demo use the `test` bounty: create a short article on test.wikipedia.org.

Paid editing on Wikimedia projects requires disclosure — see the
[Terms of Use amendment](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use/Paid_contributions_amendment).
