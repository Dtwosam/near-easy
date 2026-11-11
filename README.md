# NEAR Easy

NEAR Easy is a plain-English guide to NEAR. It answers questions with Gemini, reads a NEAR wallet after you connect it, prepares testnet funding through Tidepool, and can ask your wallet to stake native NEAR on testnet.

You approve every signature in your own wallet. The app does not ask for a seed phrase or a private key, and it does not sign by itself. Mainnet transfers and real-money transactions stay off.

The public app is [https://near-easy.vercel.app](https://near-easy.vercel.app). The source is in this repository. Confirmed testnet receipts are listed below. Describe a transaction as successful only when NEAR finalized it, or when Tidepool returned `SUCCESS` for that deposit.

## Quick Start for Hackathon Judges

Open [https://near-easy.vercel.app](https://near-easy.vercel.app). No install is required to review the interface. Approve a wallet prompt only if you choose to broadcast a new testnet transaction yourself.

1. Open the site. The sidebar has nine pages: Home, Assistant, Wallet, Funding, Staking, Explore, Features, Activity, and Settings.
2. Expected: balances marked Sample are examples. Mainnet staking and mainnet transfers stay off. The app does not ask for a seed phrase or a private key.
3. Open Assistant and ask `Check my NEAR wallet.` With no wallet connected, the reply must leave the balance unknown. It must not invent one.
4. Ask `Stake 0.5 NEAR`. Expected: the action heading is Stake NEAR. On mainnet, approval stays unavailable until you choose Use testnet. Nothing is signed until you approve the prompt in your own wallet.
5. Ask `Move 1 USDC from Solana to NEAR`. Expected: the action heading is Fund NEAR. A Tidepool quote can appear. A dry quote sends nothing and is not a finished transfer. The panel says staking is a separate step. That panel has no Open Easy Staking button.
6. Compare any finished result with [Confirmed testnet results](#confirmed-testnet-results). A fresh browser’s Activity page shows the built-in rows named in that section. A new stake or transfer is finished only after your wallet approves it and NEAR or Tidepool returns the result for that transaction.
7. Stop before Prepare deposit if you do not want a waiting deposit address. This review does not need the Tidepool faucet or `/v0/demo/run`.

## Confirmed testnet results

These receipts were read on 2026-11-11 from NEAR testnet RPC final execution, Solana devnet finalized transactions, NearBlocks, and Tidepool status at `https://www.usetidepool.tech/v0/status`. The demo video is a presentation of the product recording. The hashes below come from those network responses.

The Activity page hardcodes two rows when this device has not saved them: the 0.02 NEAR stake and the 1.9948 Tidepool `SUCCESS` below. The 0.5 NEAR stake and the 0.9974 Tidepool `SUCCESS` are confirmed on chain. They appear in Activity only when that browser saved them.

### Final demo

**Stake.** `roundwheat3869.testnet` called `deposit_and_stake` on `stakely_v2.pool.f863973.m0` (the screen label is `stakely_v2`). The attached deposit was `500000000000000000000000` yoctoNEAR, which is 0.5 NEAR. NEAR final execution status is `FINAL` with `SuccessValue`. Block time `2026-11-10T15:32:33.707050Z`.

- Transaction: [`6Z85Kx7ZmMoM8ZsrPc9zLZ3KUU8nD9pYMsGxFG8iPQ6j`](https://testnet.nearblocks.io/txns/6Z85Kx7ZmMoM8ZsrPc9zLZ3KUU8nD9pYMsGxFG8iPQ6j)

On 2026-11-11 the pool’s final `get_account_staked_balance` for this account was `500038637742956555451162` yoctoNEAR (0.500038637742956555451162 NEAR). Rewards can change that figure. The recording’s confirmation screen said the pool reported 0.4999 NEAR at that moment. This check did not recover a historical pool view with that figure. The finalized transaction attached 0.5 NEAR.

**Funding.** Tidepool status for deposit address `ADM3KPTKHngWNFacF9orqTMbEZECwZFxNujFuxbXf239` is `SUCCESS`, `updatedAt` `2026-11-10T15:33:57.464Z`. Amount in was 1 test USDC (`1000000` raw units). Amount out was 0.9974 Tidepool Testnet USDC (`997400` raw units of `usdc.tidepool-sandbox.testnet`, 6 decimals). The settled asset is Tidepool Testnet USDC.

- Solana devnet origin, finalized `2026-11-10T15:33:38Z` with no transaction error: [`2y4TWZ15qYQjtoJkz3hFsELwsj6pbCp4uskaCdS1AdV9dGuHMvbNJ2LqmV1XdXiHSCJik2gPuBKKGDf12nayWYhw`](https://explorer.solana.com/tx/2y4TWZ15qYQjtoJkz3hFsELwsj6pbCp4uskaCdS1AdV9dGuHMvbNJ2LqmV1XdXiHSCJik2gPuBKKGDf12nayWYhw?cluster=devnet). `transferChecked` moved `1000000` units of mint `7pafEGXSmR35rLKNaD6inpfLYuEnRX9DyBc1c7M8r4Xr` from `2sAJfXqtPzHqcRJ3KywTMEELCiyVmSf2Q14EEtoGy4xc`. The receiving token account was owned by the deposit address above.
- NEAR testnet settlement, final execution `FINAL`: [`HYzt1aiK2VbxxcMTYed1ctMuRxmeHNpvc7uiAG5SnSMa`](https://testnet.nearblocks.io/txns/HYzt1aiK2VbxxcMTYed1ctMuRxmeHNpvc7uiAG5SnSMa). Block time `2026-11-10T15:33:54.433923Z`. `maker.tidepool-sandbox.testnet` called `execute_intents` on `verifier.tidepool-sandbox.testnet`. The receipt transferred `997400` units of `usdc.tidepool-sandbox.testnet` to `roundwheat3869.testnet`. Receipt id `AcnAvLT8BE2NqAz3euZhcA5qTiAx9tF9cksVZqG3pmqc`.

Tidepool’s status for this deposit also names two earlier steps in the same settlement: mint [`BrPV1cBJENkrpeHwkkbT4cDc7kYtoFabABRzZcuFTEA9`](https://testnet.nearblocks.io/txns/BrPV1cBJENkrpeHwkkbT4cDc7kYtoFabABRzZcuFTEA9) and verifier credit [`Y121evn6RV2kKY46zjDvSJBKGZCSHqrY9VyVzcodgoi`](https://testnet.nearblocks.io/txns/Y121evn6RV2kKY46zjDvSJBKGZCSHqrY9VyVzcodgoi). The transfer that paid `roundwheat3869.testnet` is `HYzt1aiK2VbxxcMTYed1ctMuRxmeHNpvc7uiAG5SnSMa`.

A separate final NEAR transaction, [`5NE49U4z4rHeEfaNPp84UMUYcw4F8pB2nGigFHpGVySz`](https://testnet.nearblocks.io/txns/5NE49U4z4rHeEfaNPp84UMUYcw4F8pB2nGigFHpGVySz), also transferred `997400` units of the same token to `roundwheat3869.testnet` at `2026-11-10T14:06:15.294389Z`. This check did not find a Tidepool `SUCCESS` for that hash. It is a different transfer from the demo deposit above.

### Earlier confirmed pair

**Stake.** `roundwheat3869.testnet` called `deposit_and_stake` on `pennyvalidators.pool.f863973.m0` with deposit `20000000000000000000000` yoctoNEAR, which is 0.02 NEAR. NEAR final execution status is `FINAL` with `SuccessValue`. Block time `2026-11-10T12:01:24.537735Z`.

- Transaction: [`9mjZw2rENHfxS2frJW7c2Ds2wzbfDsvD8Fzc1M6rGMPV`](https://testnet.nearblocks.io/txns/9mjZw2rENHfxS2frJW7c2Ds2wzbfDsvD8Fzc1M6rGMPV)

On 2026-11-11 that pool’s final staked balance for this account was `19999999999999999999999` yoctoNEAR.

**Funding.** Tidepool status for deposit address `DV54oCBvdWA1FZhdFihJ776uxS2WAtaMQJfz48ckka47` is `SUCCESS`, `updatedAt` `2026-11-10T12:54:18.428Z`. Amount in was 2 test USDC. Amount out was 1.9948 Tidepool Testnet USDC (`1994800` raw units of `usdc.tidepool-sandbox.testnet`).

- Solana devnet origin, finalized `2026-11-10T12:53:59Z`: [`4V3uuKiyH6fJCd2MPuzwtnv4JRspsJgS28SP2H58V3gSjykvR7Nk55sCZW2BzbUkG5BRTWCfsB6SAgXUd5S7ScK`](https://explorer.solana.com/tx/4V3uuKiyH6fJCd2MPuzwtnv4JRspsJgS28SP2H58V3gSjykvR7Nk55sCZW2BzbUkG5BRTWCfsB6SAgXUd5S7ScK?cluster=devnet). The deposit account `DV54oCBvdWA1FZhdFihJ776uxS2WAtaMQJfz48ckka47` received 2 tokens of mint `7pafEGXSmR35rLKNaD6inpfLYuEnRX9DyBc1c7M8r4Xr` from `2sAJfXqtPzHqcRJ3KywTMEELCiyVmSf2Q14EEtoGy4xc`.
- NEAR testnet settlement, final execution `FINAL`: [`9BYDjZ6QMjDasc1cJS4Bydoa5QvvPZJ3xBjKsHa9do5U`](https://testnet.nearblocks.io/txns/9BYDjZ6QMjDasc1cJS4Bydoa5QvvPZJ3xBjKsHa9do5U). Block time `2026-11-10T12:54:15.774120Z`. The receipt transferred `1994800` units of `usdc.tidepool-sandbox.testnet` to `roundwheat3869.testnet`.

### Other finalized stakes on this account

These are not the demo receipt and they are not the hardcoded Activity row. NEAR final execution status is `FINAL` with `SuccessValue` for each.

- 0.1 NEAR to `dev10011101.pool.f863973.m0` at `2026-11-10T13:29:38.459739Z`: [`9K6k64u759QgJPg4oEBN7AJmBntFfvJoUEN2F8Xtmwf4`](https://testnet.nearblocks.io/txns/9K6k64u759QgJPg4oEBN7AJmBntFfvJoUEN2F8Xtmwf4)
- 0.01 NEAR to `davididol.pool.f863973.m0` at `2026-11-10T13:51:13.122642Z`: [`DTon26xsTDQHectTdZSWXvbXnPstFq7XdBquVxe2dvrH`](https://testnet.nearblocks.io/txns/DTon26xsTDQHectTdZSWXvbXnPstFq7XdBquVxe2dvrH)

The recording’s wallet figure of 0.63 NEAR is the account total across pools. It is not the 0.5 NEAR receipt.

## Features

Nine pages share one Premium Dark Neon interface: Home, Assistant, Wallet, Funding, Staking, Explore, Features, Activity, and Settings.

| Area | What you can do now | What stays incomplete |
| --- | --- | --- |
| Assistant | Gemini 3.5 Flash-Lite answers from the server. The chat keeps the conversation and reads verified NEAR figures. A testnet stake is prepared after a named validator matches, or after the person chooses one in the chat. An unnamed request does not pick a validator. A named Tidepool transfer is prepared in the chat. HOT Connect, Phantom, or a Base Sepolia wallet signs it. Success waits for NEAR or Tidepool. | The model cannot sign, change the preview, or invent a quote. Unstaking and mainnet stay off. A sentence is not approval. |
| NEAR wallet | HOT Connect opens a wallet you choose. The account and NEAR balance are read after you approve. | Sending NEAR is a checked preview. It does not broadcast. |
| Funding | Tidepool testnet quotes cover the networks Tidepool lists. Phantom and other Solana wallets can approve a Solana devnet transfer. An EVM wallet can approve Base Sepolia, chain id 84532. A NEAR testnet wallet can approve a token deposit. The origin transaction is checked before Tidepool is told. Two Solana devnet deposits have Tidepool `SUCCESS`: 2 test USDC settled as 1.9948, and 1 test USDC settled as 0.9974. Hashes are in Confirmed testnet results. | Success is shown only after Tidepool reports `SUCCESS` for that deposit. Base Sepolia `SUCCESS` has not been observed. Other chains show the deposit for your own wallet. Mainnet stays off. The settled token is Tidepool Testnet USDC. |
| Staking | On testnet, a connected wallet can approve `deposit_and_stake`. Commission is read from the pool. Success is shown only after NEAR finalizes the transaction and the staked balance increases. Confirmed stakes include 0.02 NEAR to `pennyvalidators.pool.f863973.m0` and 0.5 NEAR to `stakely_v2.pool.f863973.m0`. Hashes are in Confirmed testnet results. | Mainnet staking is off. Unstaking is explained and not built. |
| Directory and roadmap | Search, filters, and 30 labelled features. | Coming Soon items open an explanation. They do not run. |
| Activity | Confirmed stakes and Tidepool statuses saved on this device. When this device has not saved them, Activity also lists the built-in 0.02 NEAR stake and the built-in 1.9948 Tidepool `SUCCESS`. Example rows stay on a separate tab. | There is no multi-chain history service. The homepage and wallet page show saved rows only. The 0.5 NEAR stake and the 0.9974 `SUCCESS` are not built into the page. |

Tidepool test wNEAR (`wnear.tidepool-sandbox.testnet`) cannot be staked as native NEAR. The contract has no `near_withdraw` method, it is not `wrap.testnet`, and its account balance does not back the token supply. Funding and staking stay separate.

## Architecture

The interface is a Vite and React single-page app. Local development and Vercel share the same request handlers:

- Locally, Vite middleware in `server/assistantPlugin.ts` and `server/tidepoolPlugin.ts` calls those handlers.
- On Vercel, the build bundles `server/entries/assistant.ts` and `server/entries/funding.ts` into Node functions at `api/assistant.js` and `api/funding/[route].js`. `vercel.json` sends every path outside `/api` to `index.html`, so the nine pages load through the client router.

`GET /api/assistant` reports whether `GEMINI_API_KEY` is set. `POST /api/assistant` calls Gemini 3.5 Flash-Lite. The key is read from the server environment. It is not prefixed with `VITE_` and is not included in the browser bundle. On Vercel, set `GEMINI_API_KEY` as a server environment variable.

Each server process limits assistant calls before Gemini is contacted: 5 per minute and 30 per rolling day for one IP, and 8 per minute for that process. A limited request returns the same free-tier message as a Gemini 429 and does not call the model. The counters live in memory. A new instance starts fresh, and several instances do not share one quota.

`/api/funding/*` calls Tidepool at `https://www.usetidepool.tech`. The browser never chooses that host. The SDK default mainnet host is not used.

Wallet permissions:

- NEAR uses `@hot-labs/near-connect`. Sign-in does not add a function-call key. A stake or a NEAR-origin deposit is a separate approval.
- Solana uses the Wallet Standard, including Phantom. The app asks the wallet to sign a transaction built for Solana devnet, then submits the signed bytes only to `https://api.devnet.solana.com`.
- EVM wallets use EIP-6963 and EIP-1193. The app switches only to Base Sepolia (`0x14a34`, chain id 84532) and sends the quoted test transfer. Receipts are read from `https://sepolia.base.org`.

Saved activity lives in `localStorage` on the device. A stake row is written only after NEAR confirmation. A funding row stores the status string Tidepool returned. The homepage and wallet page show those saved rows with that status. They do not invent a success. When this device has not saved the built-in rows, the Activity page lists the 0.02 NEAR stake `9mjZw2rENHfxS2frJW7c2Ds2wzbfDsvD8Fzc1M6rGMPV` and the 1.9948 Tidepool `SUCCESS`. It does not automatically list the later 0.5 NEAR stake or the 0.9974 `SUCCESS`.

`npm start` serves a local production build with `vite preview` after `npm run build`. That process includes the assistant and funding routes. A host that only serves the files in `dist/` cannot run those routes. The public deployment uses the Vercel functions above.

## Setup

Requirements: Node.js 20 or newer, and npm.

```bash
npm install
cp .env.example .env
```

Edit `.env` and set `GEMINI_API_KEY` to a Gemini Developer API key from Google AI Studio. Keep the key on the free tier. `.env` is git-ignored. Do not commit it, print it, or put it in frontend code. For a Vercel deployment, add the same name as a server environment variable. Do not give it a `VITE_` prefix.

```bash
npm run dev
```

Open the URL Vite prints, usually `http://127.0.0.1:5173`.

Production-style local demo, still on this machine:

```bash
npm run build
npm run preview
```

That serves `http://127.0.0.1:4173` and includes the assistant and funding routes. Set `HOST` and `PORT` when another machine on your network must open the demo:

```bash
HOST=0.0.0.0 PORT=4173 npm start
```

`npm start` expects a finished `npm run build`. Review the limitations below before treating any transaction as finished.

## Limitations

- Mainnet staking is disabled in code. Solana mainnet, Base mainnet, and Ethereum mainnet chain ids are refused. Real-money transfers are off.
- Tidepool is a community testnet. It is not affiliated with NEAR. Test tokens have no value.
- Test wNEAR cannot be converted into native NEAR here, and it cannot be staked from the funding page.
- Two Tidepool `SUCCESS` results are confirmed. One is deposit address `DV54oCBvdWA1FZhdFihJ776uxS2WAtaMQJfz48ckka47`, 2 test USDC in and 1.9948 Tidepool Testnet USDC out. The other is deposit address `ADM3KPTKHngWNFacF9orqTMbEZECwZFxNujFuxbXf239`, 1 test USDC in and 0.9974 Tidepool Testnet USDC out. A confirmed origin transaction is not a finished transfer. Another deposit is finished only when Tidepool returns `SUCCESS` for it. Mainnet transfers stay off.
- Confirmed testnet stakes include `9mjZw2rENHfxS2frJW7c2Ds2wzbfDsvD8Fzc1M6rGMPV` (0.02 NEAR) and `6Z85Kx7ZmMoM8ZsrPc9zLZ3KUU8nD9pYMsGxFG8iPQ6j` (0.5 NEAR). Mainnet staking stays disabled.
- Send, unstake, swap, recurring transfers, fiat purchase, and spending limits are not built.
- The Tidepool faucet does not drip native SOL or ETH. Those fee tokens must come from a testnet faucet you already trust.
- The assistant does not receive your account id, wallet app name, or staking pool ids. It may receive aggregate figures marked live, unknown, loading, or sample.
- Notification switches are saved on the device. No alert service is connected.
- The assistant rate limit is per server process. It reduces abuse of the free Gemini quota. It is not a shared counter across every running instance.
- The public site is https://near-easy.vercel.app.

## Security

- The app never asks for a seed phrase, a private key, or recovery words.
- Nothing is signed unless you press an approve button and then approve the wallet prompt.
- Funding quotes and status calls go through `/api/funding`. The client bundle does not contain the Tidepool host, the Gemini key, or the mainnet one-click host.
- Solana submission is pinned to the devnet RPC. Base submission re-reads the chain id and stops unless it is 84532.
- Explorer links are allowlisted testnet hosts, plus NEAR Blocks for a confirmed NEAR stake on the network that stake used.
- Sample addresses, including `example.near`, are layout examples. Do not send funds to them.

## Testing

Automated checks do not broadcast a transaction and do not call the Tidepool faucet or `/v0/demo/run`.

```bash
node scripts/funding-check.mjs
node scripts/stake-check.mjs
node scripts/rate-limit-check.ts
node scripts/verify.mjs
```

`rate-limit-check.ts` exercises the in-memory assistant limiter. It does not call Gemini.

`verify.mjs` needs Google Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` and a running dev server. It walks the pages, the assistant handoff, a live Gemini reply when the key is set, and a prepared Base Sepolia deposit. Preparing a deposit creates a real Tidepool quote in `PENDING_DEPOSIT`. It does not send tokens. Leave those quotes unfinished.

`npm run build` typechecks and writes `dist/`. Confirm the client assets do not contain `GEMINI_API_KEY`, `usetidepool`, or `chaindefuser`.

### Solana devnet and Base Sepolia funding

Do this yourself. The automated checks cannot approve a wallet.

1. Open Funding. Confirm the page names Tidepool, says it is not affiliated with NEAR, and says test wNEAR cannot be turned into native NEAR.
2. For Solana, install Phantom or another Wallet Standard wallet. Switch that wallet to Solana devnet and fund it with devnet SOL for the fee. The in-app faucet does not drip SOL. For a USDC test, use a devnet USDC balance or the Tidepool faucet button. The faucet is optional and is not a transfer.
3. Choose Solana devnet and USDC. Enter a small amount, a `name.testnet` recipient, and your Solana devnet address as the refund address. Use a mainnet address for neither.
4. Choose Get testnet quote. Read the output, value gap, and expiration from the response. The page must not say the transfer succeeded.
5. Check the acknowledgement and choose Prepare deposit. Copy the deposit address from the page. Connect the Solana wallet in the Solana devnet wallet section, then choose Approve test transfer and approve the prompt.
6. After Solana devnet confirms the deposit, the page says that confirmation is in and that Tidepool has not finished the transfer. That note stays while the app submits the hash and while the status is not terminal. It is removed when Tidepool returns `SUCCESS`, `REFUNDED`, or `FAILED`.
7. Stay on the status step until Tidepool returns a terminal status. Treat the transfer as finished only when the status is exactly `SUCCESS`. `PENDING_DEPOSIT`, `KNOWN_DEPOSIT_TX`, `PROCESSING`, a confirmed origin hash, `REFUNDED`, and `FAILED` are not success.
8. Repeat the same steps for Base Sepolia with an EVM wallet. The wallet must switch to chain id 84532. Have a little Base Sepolia ETH for gas. The faucet does not drip ETH. Refuse any prompt that asks for Ethereum mainnet, Base mainnet, or chain id 8453 or 1.
9. On the Activity page, the new row must show the Tidepool status string. The homepage may show the same row. A pending row must not be labelled as a completed transfer.

Arbitrum Sepolia, Ethereum Sepolia, Stellar, Sui, Bitcoin, and XRP testnets still require you to send the deposit from your own wallet and paste the hash. Solana and Base pasted hashes are checked on the test network before Tidepool is told.

### Native NEAR staking

This is a separate test. Do not use test wNEAR as the stake.

1. Create or open a NEAR testnet account in HOT Wallet, Meteor, or MyNearWallet. Put testnet NEAR in it from a faucet you trust. Leave at least 0.05 NEAR plus storage for the fee.
2. In NEAR Easy, open the wallet control and choose testnet before you connect. Connecting on mainnet and then switching disconnects the account.
3. Open Staking. Wait until a validator and a commission appear. The commission comes from the pool contract. The reward estimate stays Unavailable.
4. Confirm the page says Tidepool test wNEAR cannot be staked as native NEAR.
5. Enter an amount at or below the available-to-stake figure. Choose Review stake, read `deposit_and_stake`, the pool account, the fee reserve, and the status Not submitted.
6. Continue, check the acknowledgement, and choose Approve in wallet. Approve the prompt in the NEAR wallet. If you reject it, the page should stay unsigned and show a declined state.
7. Wait for the result. A success screen is valid only when it shows the transaction hash, an explorer link on `testnet.nearblocks.io`, and the staked balance read back from the pool. Until that screen appears, the stake is not confirmed.
8. On a mainnet wallet, the last step must say mainnet staking is not enabled and offer Use testnet. There must be no approve button for that preview. Do not enable mainnet.

## Manual steps still required

These items cannot be completed in an automated browser that has no wallet extension:

1. Two Solana devnet transfers already returned Tidepool `SUCCESS`. The earlier one is origin `4V3uuKiyH6fJCd2MPuzwtnv4JRspsJgS28SP2H58V3gSjykvR7Nk55sCZW2BzbUkG5BRTWCfsB6SAgXUd5S7ScK` and destination `9BYDjZ6QMjDasc1cJS4Bydoa5QvvPZJ3xBjKsHa9do5U` (2 in, 1.9948 out). The later one is origin `2y4TWZ15qYQjtoJkz3hFsELwsj6pbCp4uskaCdS1AdV9dGuHMvbNJ2LqmV1XdXiHSCJik2gPuBKKGDf12nayWYhw` and destination `HYzt1aiK2VbxxcMTYed1ctMuRxmeHNpvc7uiAG5SnSMa` (1 in, 0.9974 out). Another Solana transfer still needs a wallet approval and its own `SUCCESS`.
2. Approve a Base Sepolia switch and transfer in an EVM wallet, then wait for Tidepool `SUCCESS`. That result has not been observed.
3. Confirmed NEAR testnet `deposit_and_stake` transactions include `9mjZw2rENHfxS2frJW7c2Ds2wzbfDsvD8Fzc1M6rGMPV` (0.02 NEAR) and `6Z85Kx7ZmMoM8ZsrPc9zLZ3KUU8nD9pYMsGxFG8iPQ6j` (0.5 NEAR). Another stake still needs a wallet approval.
4. Optionally approve a NEAR testnet `ft_transfer_call` when the funding source is NEAR testnet.

Easy Staking and cross-chain funding are available on testnet. Two funding transfers returned Tidepool `SUCCESS`. Another transfer is complete only when Tidepool returns `SUCCESS` for that deposit. Mainnet staking and mainnet transfers stay off.

## Hackathon demonstration

A honest demo, with no broadcast required:

1. Start on the homepage and read what the app does, including the wNEAR limit.
2. Ask the assistant “Check my NEAR wallet.” With no wallet connected, it must not invent a balance.
3. Ask “Use $100 from Solana to stake NEAR.” The chat prepares a Tidepool quote. The action panel says staking is a separate step. It does not stake the bridged amount, and it has no Open Easy Staking link.
4. On Funding, request a dry quote and show the Tidepool output. Stop before Prepare deposit if you do not want a waiting deposit address.
5. On Staking, show a live commission and the mainnet lock.
6. On Settings, show that the seed phrase stays in the wallet and that Solana devnet and Base Sepolia are the only in-app origin approvals.

Stop there unless you are ready to approve a testnet wallet prompt yourself.
