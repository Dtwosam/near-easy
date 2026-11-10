// src/funding/tidepoolServer.ts
import { ApiError, OneClickService, OpenAPI, QuoteRequest } from "@defuse-protocol/one-click-sdk-typescript";

// src/funding/plan.ts
var TIDEPOOL_ORIGIN = "https://www.usetidepool.tech";
var CHAIN_LABELS = {
  sol: "Solana devnet",
  base: "Base Sepolia",
  arb: "Arbitrum Sepolia",
  eth: "Ethereum Sepolia",
  near: "NEAR testnet",
  stellar: "Stellar testnet",
  sui: "Sui testnet",
  btc: "Bitcoin testnet4",
  xrp: "XRP Ledger testnet"
};
var CHAIN_ORDER = ["sol", "base", "arb", "eth", "near", "stellar", "sui", "btc", "xrp"];
var STATUSES = /* @__PURE__ */ new Set([
  "PENDING_DEPOSIT",
  "KNOWN_DEPOSIT_TX",
  "INCOMPLETE_DEPOSIT",
  "PROCESSING",
  "SUCCESS",
  "REFUNDED",
  "FAILED"
]);
var EXPLORER_HOSTS = /* @__PURE__ */ new Set([
  "testnet.nearblocks.io",
  "explorer.solana.com",
  "sepolia.basescan.org",
  "sepolia.arbiscan.io",
  "sepolia.etherscan.io",
  "stellar.expert",
  "testnet.stellarchain.io",
  "suiscan.xyz",
  "testnet.suivision.xyz",
  "mempool.space",
  "blockstream.info",
  "testnet.xrpl.org"
]);
function chainLabel(id) {
  return CHAIN_LABELS[id] ?? `${id} testnet`;
}
function supportedChain(id) {
  return Object.prototype.hasOwnProperty.call(CHAIN_LABELS, id);
}
function isTestnetAssetId(assetId) {
  return assetId.startsWith("nep141:") && /\.testnet$/.test(assetId) && !/\.near(?:\.|$)/.test(assetId);
}
function isNearTestnetAccount(value) {
  const account = value.trim().toLowerCase();
  if (/^[0-9a-f]{64}$/.test(account)) return true;
  if (!account.endsWith(".testnet") || account.length < 2 || account.length > 64) return false;
  return /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(account);
}
function isOriginAddress(blockchain, value) {
  const address = value.trim();
  if (!address || /\s/.test(address)) return false;
  if (blockchain === "near") return isNearTestnetAccount(address);
  if (blockchain === "base" || blockchain === "arb" || blockchain === "eth") return /^0x[0-9a-fA-F]{40}$/.test(address);
  if (blockchain === "sol") return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  if (blockchain === "stellar") return /^G[A-Z2-7]{55}$/.test(address);
  if (blockchain === "sui") return /^0x[0-9a-fA-F]{64}$/.test(address);
  if (blockchain === "btc") return /^(tb1[ac-hj-np-z02-9]{8,87}|[mn2][1-9A-HJ-NP-Za-km-z]{25,34})$/i.test(address);
  if (blockchain === "xrp") return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address);
  return false;
}
function isDepositHash(value) {
  const hash = value.trim();
  return /^0x[0-9a-fA-F]{64}$/.test(hash) || /^[1-9A-HJ-NP-Za-km-z]{32,128}$/.test(hash);
}
function isDepositAddress(value) {
  const address = value.trim();
  return address.length >= 8 && address.length <= 128 && /^[a-zA-Z0-9._:-]+$/.test(address);
}
function parseFundingAmount(value) {
  const trimmed = value.trim();
  if (!/^\d{1,12}(\.\d{1,12})?$/.test(trimmed)) return null;
  if (!Number.isFinite(Number(trimmed)) || Number(trimmed) <= 0) return null;
  return trimmed;
}
function toBaseUnits(amount, decimals) {
  const parsed = parseFundingAmount(amount);
  if (!parsed || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;
  const [whole, fraction = ""] = parsed.split(".");
  if (fraction.length > decimals) return null;
  const digits = `${whole}${fraction.padEnd(decimals, "0")}`.replace(/^0+/, "");
  return digits || null;
}
function formatBaseUnits(amount, decimals) {
  if (!/^\d+$/.test(amount) || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;
  if (decimals === 0) return amount.replace(/^0+/, "") || "0";
  const padded = amount.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals).replace(/^0+/, "") || "0";
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
function quoteDeadline(blockchain, now = Date.now()) {
  const minutes = blockchain === "btc" ? 120 : 30;
  return new Date(now + minutes * 6e4).toISOString();
}
function usdGap(input, output) {
  if (!input || !output || !/^\d+(\.\d+)?$/.test(input) || !/^\d+(\.\d+)?$/.test(output)) return null;
  const scale = 10000n;
  const toInt = (value) => {
    const [whole2, fraction2 = ""] = value.split(".");
    return BigInt(whole2) * scale + BigInt(fraction2.padEnd(4, "0").slice(0, 4));
  };
  const gap = toInt(input) - toInt(output);
  const negative = gap < 0n;
  const absolute = negative ? -gap : gap;
  const whole = absolute / scale;
  const fraction = (absolute % scale).toString().padStart(4, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${fraction ? `${whole.toString()}.${fraction}` : whole.toString()}`;
}
function trustedExplorer(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (!EXPLORER_HOSTS.has(host)) return null;
  const path = url.pathname.toLowerCase();
  if (host === "explorer.solana.com" && url.searchParams.get("cluster") !== "devnet") return null;
  if (host === "stellar.expert" && !path.includes("/testnet")) return null;
  if ((host === "mempool.space" || host === "blockstream.info" || host === "suiscan.xyz") && !path.includes("testnet")) return null;
  return url.toString();
}
function normalizeToken(input) {
  if (!input || typeof input !== "object") return null;
  const row = input;
  if (typeof row.assetId !== "string" || !isTestnetAssetId(row.assetId)) return null;
  if (typeof row.blockchain !== "string" || !supportedChain(row.blockchain)) return null;
  if (typeof row.symbol !== "string" || !/^[A-Za-z0-9.]{1,12}$/.test(row.symbol)) return null;
  if (typeof row.decimals !== "number" || !Number.isInteger(row.decimals) || row.decimals < 0 || row.decimals > 36) return null;
  const contract = typeof row.contractAddress === "string" && row.contractAddress.trim() ? row.contractAddress.trim() : null;
  return {
    assetId: row.assetId,
    blockchain: row.blockchain,
    symbol: row.symbol,
    decimals: row.decimals,
    contractAddress: contract
  };
}
function catalogFromTokens(rows) {
  const tokens = rows.map(normalizeToken).filter((token) => Boolean(token));
  tokens.sort((a, b) => {
    const chain = CHAIN_ORDER.indexOf(a.blockchain) - CHAIN_ORDER.indexOf(b.blockchain);
    if (chain) return chain;
    return symbolRank(a.symbol) - symbolRank(b.symbol) || a.symbol.localeCompare(b.symbol);
  });
  const seen = /* @__PURE__ */ new Set();
  const chains = tokens.flatMap((token) => {
    if (seen.has(token.blockchain)) return [];
    seen.add(token.blockchain);
    return [{ id: token.blockchain, label: chainLabel(token.blockchain) }];
  });
  return {
    provider: "Tidepool",
    affiliate: "Community-operated. Not affiliated with NEAR.",
    mainnet: false,
    stakeableNativeNear: false,
    nativeNearAssetListed: tokens.some((token) => token.blockchain === "near" && token.symbol === "NEAR"),
    tokens,
    chains
  };
}
function symbolRank(symbol) {
  if (symbol === "USDC") return 0;
  if (symbol === "USDT") return 1;
  if (symbol === "wNEAR") return 2;
  return 3;
}
function findToken(tokens, assetId) {
  return tokens.find((token) => token.assetId === assetId) ?? null;
}
function publicQuote(input) {
  if (!input.body || typeof input.body !== "object") return null;
  const body = input.body;
  const quote = body.quote && typeof body.quote === "object" ? body.quote : null;
  if (!quote || typeof body.correlationId !== "string" || typeof body.signature !== "string") return null;
  if (typeof quote.amountIn !== "string" || typeof quote.amountOut !== "string" || typeof quote.amountOutFormatted !== "string") return null;
  const depositAddress = typeof quote.depositAddress === "string" ? quote.depositAddress : null;
  if (input.dry && depositAddress) return null;
  if (!input.dry && !depositAddress) return null;
  const amountInUsd = typeof quote.amountInUsd === "string" ? quote.amountInUsd : null;
  const amountOutUsd = typeof quote.amountOutUsd === "string" ? quote.amountOutUsd : null;
  const minAmountOut = typeof quote.minAmountOut === "string" ? quote.minAmountOut : null;
  return {
    dry: input.dry,
    correlationId: body.correlationId,
    signature: body.signature,
    originAsset: input.origin.assetId,
    destinationAsset: input.destination.assetId,
    originSymbol: input.origin.symbol,
    destinationSymbol: input.destination.symbol,
    originBlockchain: input.origin.blockchain,
    destinationBlockchain: input.destination.blockchain,
    originLabel: chainLabel(input.origin.blockchain),
    destinationLabel: chainLabel(input.destination.blockchain),
    amountIn: quote.amountIn,
    amountInFormatted: typeof quote.amountInFormatted === "string" ? quote.amountInFormatted : formatBaseUnits(quote.amountIn, input.origin.decimals) ?? quote.amountIn,
    amountInUsd,
    amountOut: quote.amountOut,
    amountOutFormatted: quote.amountOutFormatted,
    amountOutUsd,
    minAmountOut: minAmountOut ?? "",
    minAmountOutFormatted: minAmountOut ? formatBaseUnits(minAmountOut, input.destination.decimals) : null,
    quotedValueGap: usdGap(amountInUsd, amountOutUsd),
    withdrawFee: typeof quote.withdrawFee === "string" ? formatBaseUnits(quote.withdrawFee, input.destination.decimals) : null,
    timeEstimate: typeof quote.timeEstimate === "number" ? quote.timeEstimate : null,
    deadline: typeof quote.deadline === "string" ? quote.deadline : null,
    depositAddress,
    depositMemo: typeof quote.depositMemo === "string" ? quote.depositMemo : null,
    depositType: input.depositType,
    refundTo: input.refundTo,
    recipient: input.recipient,
    contractAddress: input.origin.contractAddress,
    stakeableNativeNear: false
  };
}
function statusLabel(status) {
  switch (status) {
    case "PENDING_DEPOSIT":
      return "Waiting for your deposit";
    case "KNOWN_DEPOSIT_TX":
      return "Deposit hash received";
    case "INCOMPLETE_DEPOSIT":
      return "Deposit is short";
    case "PROCESSING":
      return "Tidepool is settling";
    case "SUCCESS":
      return "Tidepool reported SUCCESS";
    case "REFUNDED":
      return "Tidepool refunded the deposit";
    case "FAILED":
      return "Tidepool reported FAILED";
    default:
      return "Status was not recognised";
  }
}
function isTerminalStatus(status) {
  return status === "SUCCESS" || status === "REFUNDED" || status === "FAILED";
}
var verifiedTestnetFunding = {
  depositAddress: "DV54oCBvdWA1FZhdFihJ776uxS2WAtaMQJfz48ckka47",
  status: "SUCCESS",
  label: statusLabel("SUCCESS"),
  when: "2026-11-10T12:54:18.428Z",
  origin: "2 USDC \xB7 Solana devnet",
  destination: "1.9948 USDC to roundwheat3869.testnet",
  amountIn: "2",
  amountOut: "1.9948",
  refundReason: "",
  hashes: [
    {
      hash: "4V3uuKiyH6fJCd2MPuzwtnv4JRspsJgS28SP2H58V3gSjykvR7Nk55sCZW2BzbUkG5BRTWCfsB6SAgXUd5S7ScK",
      url: "https://explorer.solana.com/tx/4V3uuKiyH6fJCd2MPuzwtnv4JRspsJgS28SP2H58V3gSjykvR7Nk55sCZW2BzbUkG5BRTWCfsB6SAgXUd5S7ScK?cluster=devnet",
      label: "Solana devnet deposit"
    },
    {
      hash: "9BYDjZ6QMjDasc1cJS4Bydoa5QvvPZJ3xBjKsHa9do5U",
      url: "https://testnet.nearblocks.io/txns/9BYDjZ6QMjDasc1cJS4Bydoa5QvvPZJ3xBjKsHa9do5U",
      label: "NEAR testnet settlement"
    }
  ]
};
function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function hashFromExplorer(url) {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const last = parts.at(-1) ?? "";
    return isDepositHash(last) ? last : null;
  } catch {
    return null;
  }
}
function parseStatusPayload(input) {
  if (!input || typeof input !== "object") return null;
  const body = input;
  if (typeof body.status !== "string" || !STATUSES.has(body.status)) return null;
  const details = body.swapDetails && typeof body.swapDetails === "object" ? body.swapDetails : {};
  const hashes = [];
  const seen = /* @__PURE__ */ new Set();
  const push = (hash, url, label) => {
    const key = `${label}:${hash}`;
    if (seen.has(key)) return;
    seen.add(key);
    hashes.push({ hash, url, label: label.slice(0, 80) });
  };
  const linked = (value, label) => {
    if (!Array.isArray(value)) return;
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const row = item;
      if (typeof row.hash !== "string" || !isDepositHash(row.hash)) continue;
      push(row.hash, typeof row.explorerUrl === "string" ? trustedExplorer(row.explorerUrl) : null, label);
    }
  };
  linked(details.originChainTxHashes, "Origin chain");
  linked(details.destinationChainTxHashes, "Destination chain");
  if (Array.isArray(details.nearTxHashes)) {
    for (const hash of details.nearTxHashes) {
      if (typeof hash === "string" && isDepositHash(hash)) {
        push(hash, trustedExplorer(`https://testnet.nearblocks.io/txns/${hash}`), "NEAR testnet");
      }
    }
  }
  if (Array.isArray(body.tidepool?.explorer)) {
    for (const item of body.tidepool.explorer) {
      if (!item || typeof item !== "object") continue;
      const row = item;
      if (typeof row.url !== "string") continue;
      const url = trustedExplorer(row.url);
      const hash = hashFromExplorer(row.url);
      if (url && hash) push(hash, url, typeof row.label === "string" ? row.label : "Tidepool");
    }
  }
  const quoteAddress = body.quoteResponse?.quote?.depositAddress;
  return {
    status: body.status,
    label: statusLabel(body.status),
    terminal: isTerminalStatus(body.status),
    updatedAt: text(body.updatedAt),
    depositAddress: typeof quoteAddress === "string" ? quoteAddress : null,
    amountInFormatted: text(details.amountInFormatted) ?? text(details.depositedAmountFormatted),
    amountOutFormatted: text(details.amountOutFormatted),
    refundedAmountFormatted: text(details.refundedAmountFormatted),
    refundReason: text(details.refundReason),
    hashes
  };
}

// src/funding/tidepoolServer.ts
if (typeof window !== "undefined") {
  throw new Error("Tidepool calls stay on the server.");
}
var FundingError = class extends Error {
  status;
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
var cache = null;
function lockTidepool() {
  OpenAPI.BASE = TIDEPOOL_ORIGIN;
  OpenAPI.TOKEN = void 0;
  if (OpenAPI.BASE !== TIDEPOOL_ORIGIN) {
    throw new FundingError(500, "Funding is locked to the Tidepool testnet.");
  }
}
function cleanMessage(error) {
  if (error instanceof FundingError) return { status: error.status, message: error.message };
  if (error instanceof ApiError) {
    const body = error.body;
    const raw = typeof body?.message === "string" ? body.message : "Tidepool rejected the request.";
    const message = raw.replace(/\s+/g, " ").replace(/https?:\/\/\S+/g, "").trim().slice(0, 240);
    const status = error.status >= 400 && error.status < 500 ? 400 : 502;
    return { status, message: message || "Tidepool rejected the request." };
  }
  return { status: 502, message: "Tidepool could not be reached." };
}
function explainTidepool(error) {
  return cleanMessage(error);
}
async function loadTokens() {
  if (cache && Date.now() - cache.at < 3e4) return cache.tokens;
  lockTidepool();
  const rows = await OneClickService.getTokens();
  const tokens = catalogFromTokens(rows).tokens;
  if (!tokens.length) throw new FundingError(502, "Tidepool returned no testnet tokens.");
  cache = { at: Date.now(), tokens };
  return tokens;
}
async function tidepoolCatalog() {
  return catalogFromTokens(await loadTokens());
}
async function tidepoolQuote(input) {
  if (!isTestnetAssetId(input.originAsset) || !isTestnetAssetId(input.destinationAsset)) {
    throw new FundingError(400, "Only Tidepool testnet assets can be quoted.");
  }
  if (!parseFundingAmount(input.amount)) throw new FundingError(400, "Enter an amount greater than zero.");
  const tokens = await loadTokens();
  const origin = findToken(tokens, input.originAsset);
  const destination = findToken(tokens, input.destinationAsset);
  if (!origin || !destination) throw new FundingError(400, "That token is not in the current Tidepool testnet list.");
  if (destination.blockchain !== "near") throw new FundingError(400, "Funding pays out only to a NEAR testnet token.");
  const recipient = input.recipient.trim().toLowerCase();
  const refundTo = origin.blockchain === "near" ? input.refundTo.trim().toLowerCase() : input.refundTo.trim();
  if (!isNearTestnetAccount(recipient)) {
    throw new FundingError(400, "The recipient must be a NEAR testnet account, such as name.testnet.");
  }
  if (!isOriginAddress(origin.blockchain, refundTo)) {
    throw new FundingError(400, `Enter a ${origin.blockchain === "near" ? "NEAR testnet" : chainRefundName(origin.blockchain)} refund address.`);
  }
  const amount = toBaseUnits(input.amount, origin.decimals);
  if (!amount) throw new FundingError(400, `This token uses ${origin.decimals} decimal places.`);
  const depositType = origin.blockchain === "near" ? QuoteRequest.depositType.INTENTS : QuoteRequest.depositType.ORIGIN_CHAIN;
  const memoChain = origin.blockchain === "stellar" || origin.blockchain === "xrp";
  lockTidepool();
  const response = await OneClickService.getQuote({
    dry: input.dry,
    swapType: QuoteRequest.swapType.EXACT_INPUT,
    slippageTolerance: 100,
    originAsset: origin.assetId,
    destinationAsset: destination.assetId,
    amount,
    depositType,
    depositMode: memoChain ? QuoteRequest.depositMode.MEMO : QuoteRequest.depositMode.SIMPLE,
    refundTo,
    refundType: QuoteRequest.refundType.ORIGIN_CHAIN,
    recipient,
    recipientType: QuoteRequest.recipientType.DESTINATION_CHAIN,
    deadline: quoteDeadline(origin.blockchain),
    referral: "near-easy"
  });
  const quote = publicQuote({
    body: response,
    origin,
    destination,
    dry: input.dry,
    refundTo,
    recipient,
    depositType: origin.blockchain === "near" ? "INTENTS" : "ORIGIN_CHAIN"
  });
  if (!quote) throw new FundingError(502, "Tidepool returned a quote this app could not verify.");
  if (OpenAPI.BASE !== TIDEPOOL_ORIGIN) throw new FundingError(500, "Funding is locked to the Tidepool testnet.");
  return quote;
}
function chainRefundName(blockchain) {
  if (blockchain === "sol") return "Solana devnet";
  if (blockchain === "base") return "Base Sepolia";
  if (blockchain === "arb") return "Arbitrum Sepolia";
  if (blockchain === "eth") return "Ethereum Sepolia";
  return "testnet";
}
async function tidepoolStatus(depositAddress, depositMemo) {
  if (!isDepositAddress(depositAddress)) throw new FundingError(400, "That deposit address cannot be checked.");
  const memo = depositMemo?.trim() || void 0;
  if (memo && !/^[a-zA-Z0-9._:-]{1,128}$/.test(memo)) throw new FundingError(400, "That memo cannot be checked.");
  lockTidepool();
  const response = await OneClickService.getExecutionStatus(depositAddress, memo);
  const status = parseStatusPayload(response);
  if (!status) throw new FundingError(502, "Tidepool returned a status this app could not verify.");
  return status;
}
async function tidepoolSubmit(input) {
  const txHash = input.txHash.trim();
  if (!isDepositHash(txHash)) throw new FundingError(400, "Enter the transaction hash from your wallet.");
  if (!isDepositAddress(input.depositAddress)) throw new FundingError(400, "That deposit address cannot be checked.");
  const memo = input.memo?.trim() || void 0;
  const nearSenderAccount = input.nearSenderAccount?.trim().toLowerCase() || void 0;
  if (nearSenderAccount && !isNearTestnetAccount(nearSenderAccount)) {
    throw new FundingError(400, "The NEAR sender must be a testnet account.");
  }
  lockTidepool();
  const response = await OneClickService.submitDepositTx({
    txHash,
    depositAddress: input.depositAddress.trim(),
    memo,
    nearSenderAccount
  });
  const status = parseStatusPayload(response);
  if (!status) throw new FundingError(502, "Tidepool returned a status this app could not verify.");
  return status;
}
async function tidepoolFaucet(input) {
  lockTidepool();
  let payload;
  if (input.accountId) {
    const accountId = input.accountId.trim().toLowerCase();
    if (!isNearTestnetAccount(accountId)) throw new FundingError(400, "The faucet needs a NEAR testnet account.");
    payload = { accountId, mode: "wallet" };
  } else if (input.chain && input.address) {
    const chain = input.chain.trim();
    if (!["sol", "base", "arb", "eth", "stellar", "sui"].includes(chain)) {
      throw new FundingError(400, "This faucet supports Solana devnet, the Sepolia networks, Stellar testnet, and Sui testnet.");
    }
    if (!isOriginAddress(chain, input.address)) throw new FundingError(400, "That faucet address does not match the test network.");
    payload = { chain, address: input.address.trim() };
  } else {
    throw new FundingError(400, "Enter the testnet address that should receive test tokens.");
  }
  const response = await fetch(`${TIDEPOOL_ORIGIN}/v0/faucet`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(2e4)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message2 = typeof body?.message === "string" ? body.message : typeof body?.error === "string" ? body.error : "The faucet request was not accepted.";
    throw new FundingError(response.status >= 500 ? 502 : 400, message2.replace(/\s+/g, " ").slice(0, 240));
  }
  const hash = typeof body?.txHash === "string" ? body.txHash : typeof body?.hash === "string" ? body.hash : "";
  const message = typeof body?.message === "string" ? body.message.replace(/\s+/g, " ").slice(0, 240) : "";
  return [message, hash ? `Transaction ${hash}` : ""].filter(Boolean).join(" ") || "Tidepool accepted the faucet request. This is not a cross-chain transfer.";
}

// server/fundingHandler.ts
var FUNDING_BODY_LIMIT = 16e3;
function text2(value) {
  return typeof value === "string" ? value : "";
}
async function handleFundingHttp(input) {
  let parsed = null;
  if (input.method === "POST") {
    if (input.rawBody.length > FUNDING_BODY_LIMIT) return { status: 413, body: { error: "That request is too long." } };
    try {
      const value = JSON.parse(input.rawBody);
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { status: 400, body: { error: "The funding request could not be read." } };
      }
      parsed = value;
    } catch {
      return { status: 400, body: { error: "The funding request could not be read." } };
    }
  }
  try {
    if (input.route === "tokens" && input.method === "GET") return { status: 200, body: await tidepoolCatalog() };
    if (input.route === "quote" && input.method === "POST" && parsed) {
      return {
        status: 200,
        body: await tidepoolQuote({
          dry: parsed.dry !== false,
          originAsset: text2(parsed.originAsset),
          destinationAsset: text2(parsed.destinationAsset),
          amount: text2(parsed.amount),
          refundTo: text2(parsed.refundTo),
          recipient: text2(parsed.recipient)
        })
      };
    }
    if (input.route === "status" && input.method === "GET") {
      return { status: 200, body: await tidepoolStatus(input.query.get("depositAddress") ?? "", input.query.get("depositMemo") ?? "") };
    }
    if (input.route === "deposit" && input.method === "POST" && parsed) {
      return {
        status: 200,
        body: await tidepoolSubmit({
          txHash: text2(parsed.txHash),
          depositAddress: text2(parsed.depositAddress),
          memo: text2(parsed.memo),
          nearSenderAccount: text2(parsed.nearSenderAccount)
        })
      };
    }
    if (input.route === "faucet" && input.method === "POST" && parsed) {
      const detail = await tidepoolFaucet({
        chain: text2(parsed.chain),
        address: text2(parsed.address),
        accountId: text2(parsed.accountId)
      });
      return { status: 200, body: { detail } };
    }
    return { status: 404, body: { error: "That funding route is not available." } };
  } catch (error) {
    const explained = explainTidepool(error);
    return { status: explained.status, body: { error: explained.message } };
  }
}

// server/http.ts
function send(res, status, body) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}
function rawBody(body) {
  if (body == null || body === "") return "";
  if (typeof body === "string") return body;
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  return JSON.stringify(body);
}

// server/entries/funding.ts
var config = { maxDuration: 30 };
async function handler(req, res) {
  const route = typeof req.query?.route === "string" ? req.query.route : "";
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query ?? {})) {
    if (key === "route" || typeof value !== "string") continue;
    query.set(key, value);
  }
  const method = req.method ?? "GET";
  const result = await handleFundingHttp({
    method,
    route,
    query,
    rawBody: method === "POST" ? rawBody(req.body) : ""
  });
  send(res, result.status, result.body);
}
export {
  config,
  handler as default
};
