import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

const plan = await server.ssrLoadModule('/src/funding/plan.ts');
const logic = await server.ssrLoadModule('/src/logic.ts');
const tide = await server.ssrLoadModule('/src/funding/tidepoolServer.ts');
const origin = await server.ssrLoadModule('/src/funding/originPlan.ts');
const rpc = await server.ssrLoadModule('/src/funding/originRpc.ts');
const evm = await server.ssrLoadModule('/src/funding/evmWallet.ts');
const solanaTx = await server.ssrLoadModule('/src/funding/solanaTransfer.ts');
const solanaWallet = await server.ssrLoadModule('/src/funding/solanaWallet.ts');

const failures = [];
function check(name, ok, detail = '') {
  const line = `${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`;
  console.log(line);
  if (!ok) failures.push(line);
}

const move = logic.parseFundingAsk('Move 10 test USDC from Solana to NEAR');
check('move 10 parses Solana USDC', move.amount === '10' && move.chain === 'sol' && move.token === 'USDC' && move.tokenWasNamed && move.chainWasNamed && move.amountWasNamed === true, JSON.stringify(move));
check('an unnamed amount is not quoted', logic.parseFundingAsk('Move funds from Solana').amountWasNamed === false);
check('named testnet recipient', logic.parseFundingRecipient('Send 2 USDC to roundwheat3869.testnet') === 'roundwheat3869.testnet');
check('mainnet recipient is not used', logic.parseFundingRecipient('Send 2 USDC to alice.near') === null);
const stakePath = logic.parseFundingAsk('Use $100 from Solana to stake NEAR');
check('fund-stake amount stays 100 USDC', stakePath.amount === '100' && stakePath.chain === 'sol' && stakePath.token === 'USDC');
check('fund intent for a move', logic.matchIntent('Move 10 test USDC from Solana to NEAR') === 'fund');
check('fund-stake still wins when staking is named', logic.matchIntent('Use $100 USDC from Solana to stake NEAR') === 'fund-stake');

const exact = 'Move 1 test USDC from my Solana wallet to roundwheat3869.testnet.';
const exactAsk = logic.parseFundingAsk(exact);
check('wallet wording still funds', logic.matchIntent(exact) === 'fund');
check('exact request keeps amount, token, and Solana', exactAsk.amount === '1' && exactAsk.token === 'USDC' && exactAsk.chain === 'sol' && exactAsk.amountWasNamed && exactAsk.tokenWasNamed && exactAsk.chainWasNamed, JSON.stringify(exactAsk));
check('exact request keeps the destination', logic.parseFundingRecipient(exact) === 'roundwheat3869.testnet');

const variations = [
  ['Send 2 test USDT from my Base wallet to bob.testnet', 'fund', '2', 'USDT', 'base', 'bob.testnet'],
  ['Please transfer 0.5 USDC from the Solana wallet to roundwheat3869.testnet', 'fund', '0.5', 'USDC', 'sol', 'roundwheat3869.testnet'],
  ['Bridge 3 USDC using my Ethereum wallet to carol.testnet', 'fund', '3', 'USDC', 'eth', 'carol.testnet'],
  ['Can you move 4 USDC out of my Solana wallet into dave.testnet?', 'fund', '4', 'USDC', 'sol', 'dave.testnet'],
  ['Move 1 USDC from Solana to my NEAR account roundwheat3869.testnet', 'fund', '1', 'USDC', 'sol', 'roundwheat3869.testnet'],
  ['Move 1 test USDC from my Solana wallet to roundwheat3869.testnet. I also use Base.', 'fund', '1', 'USDC', 'sol', 'roundwheat3869.testnet'],
];
for (const [sentence, intent, amount, token, chain, recipient] of variations) {
  const parsed = logic.parseFundingAsk(sentence);
  check(`variation intent: ${sentence}`, logic.matchIntent(sentence) === intent, logic.matchIntent(sentence));
  check(`variation fields: ${sentence}`, parsed.amount === amount && parsed.token === token && parsed.chain === chain && parsed.amountWasNamed && parsed.chainWasNamed && logic.parseFundingRecipient(sentence) === recipient, JSON.stringify(parsed));
}

check('wallet question stays a wallet question', logic.matchIntent('Check my NEAR wallet.') === 'wallet');
check('balance question stays a wallet question', logic.matchIntent('What is my balance?') === 'wallet');
check('solana balance stays a wallet question', logic.matchIntent("What's my Solana wallet balance?") === 'wallet');
check('show my wallet stays a wallet question', logic.matchIntent('Show my wallet') === 'wallet');
check('plain stake stays staking', logic.matchIntent('Stake 0.5 NEAR') === 'stake');
check('named validator stays staking', logic.matchIntent('Stake 0.5 NEAR with aurora') === 'stake');
check('unstake stays staking', logic.matchIntent('Unstake 5 NEAR') === 'stake');
check('signing sentence stays blocked', logic.matchIntent('Sign the transaction') === 'execute-blocked');
check('send the transaction stays blocked', logic.matchIntent('Send the transaction from my Solana wallet') === 'execute-blocked');
check('do it now stays blocked', logic.matchIntent('Do it now') === 'execute-blocked');
check('confirm and stake stays blocked', logic.matchIntent('Confirm and stake') === 'execute-blocked');
check('mainnet account is rejected', plan.isNearTestnetAccount('alice.near') === false && plan.isNearTestnetAccount('alice.testnet') === true);
check('ten USDC is 10000000 base units', plan.toBaseUnits('10', 6) === '10000000');
check('too many decimals are rejected', plan.toBaseUnits('0.0000001', 6) === null);
check('mainnet asset id is rejected', plan.isTestnetAssetId('nep141:usdc.omft.near') === false);
check('tidepool asset id is accepted', plan.isTestnetAssetId('nep141:wnear.tidepool-sandbox.testnet') === true);
check('value gap uses the quote fields', plan.usdGap('9.9948', '9.9498') === '0.045');
check('mainnet explorer is not linked', plan.trustedExplorer('https://nearblocks.io/txns/11111111111111111111111111111111') === null);
check('solana explorer requires devnet', plan.trustedExplorer('https://explorer.solana.com/tx/11111111111111111111111111111111') === null);
check('devnet solana explorer is kept', plan.trustedExplorer('https://explorer.solana.com/tx/11111111111111111111111111111111?cluster=devnet')?.includes('cluster=devnet') === true);

const evil = plan.parseStatusPayload({
  status: 'SUCCESS',
  swapDetails: {
    originChainTxHashes: [{ hash: '11111111111111111111111111111111', explorerUrl: 'https://evil.example/tx/11111111111111111111111111111111' }],
    nearTxHashes: ['22222222222222222222222222222222'],
  },
});
check('success status is recognised', evil?.status === 'SUCCESS' && evil.terminal === true);
check('untrusted explorer is withheld', evil.hashes.some((hash) => hash.hash.startsWith('1111') && hash.url === null));
check('near hash links to testnet', evil.hashes.some((hash) => hash.url === 'https://testnet.nearblocks.io/txns/22222222222222222222222222222222'));
check('missing status is not success', plan.parseStatusPayload({ status: 'DONE' }) === null);

const action = plan.nearDepositAction({
  dry: false,
  depositType: 'INTENTS',
  originBlockchain: 'near',
  depositAddress: 'a'.repeat(64),
  contractAddress: 'usdc.tidepool-sandbox.testnet',
  amountIn: '1000000',
});
check('near deposit is one ft_transfer_call', action?.methodName === 'ft_transfer_call' && action.args.receiver_id === plan.VERIFIER_ACCOUNT && action.args.amount === '1000000' && action.deposit === '1');
check('dry quote cannot build a deposit', plan.nearDepositAction({ ...action, dry: true, depositType: 'INTENTS', originBlockchain: 'near', depositAddress: 'a'.repeat(64), contractAddress: 'usdc.tidepool-sandbox.testnet', amountIn: '1' }) === null);

const baseQuote = {
  dry: false,
  originBlockchain: 'base',
  depositType: 'ORIGIN_CHAIN',
  depositAddress: '0x2222222222222222222222222222222222222222',
  contractAddress: '0x38d81431B9f76d9699AF7517040D5221D9dEA252',
  amountIn: '10000000',
};
const call = origin.evmTransferCall(baseQuote);
check('base transfer is an ERC-20 transfer on chain 84532', call?.chainId === 84532 && call.to === '0x38d81431b9f76d9699af7517040d5221d9dea252' && call.value === '0x0' && call.data.startsWith('0xa9059cbb'));
check('erc20 amount is the quoted base units', call?.data.slice(-64) === 10000000n.toString(16).padStart(64, '0') && call.data.slice(10, 74) === '2222222222222222222222222222222222222222'.padStart(64, '0'));
check('mainnet chain ids are refused', origin.isBaseSepolia(1) === false && origin.isBaseSepolia(8453) === false && origin.isBaseSepolia('0x2105') === false && origin.isBaseSepolia('0x14a34') === true);
check('mainnet USDC cannot be encoded', origin.evmTransferCall({ ...baseQuote, contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' }) === null);
check('solana and base rpcs stay on test networks', origin.SOLANA_DEVNET_RPC === 'https://api.devnet.solana.com' && origin.BASE_SEPOLIA_RPC === 'https://sepolia.base.org');
let refusedRpc = false;
try {
  origin.assertSolanaDevnetRpc('https://api.mainnet-beta.solana.com');
} catch {
  refusedRpc = true;
}
check('mainnet solana rpc is refused', refusedRpc);

const depositOwner = '13QkxhNMrTPxoCkRdYdJ65tFuwXPhL5gLS2Z5Nr6gjRK';
const mint = '7pafEGXSmR35rLKNaD6inpfLYuEnRX9DyBc1c7M8r4Xr';
const payer = 'BEijzwSQpWxbgQQ5NfBePxUzHgLoc2vrApPe8G4St55Q';
const spl = solanaTx.buildSolanaDepositTransaction({
  owner: payer,
  depositAddress: depositOwner,
  amount: '10000000',
  mint,
  decimals: 6,
  recentBlockhash: '11111111111111111111111111111111',
});
const splData = spl ? Buffer.from(spl.instructions.at(-1).data) : null;
check('spl transfer is built and not sent', Boolean(spl) && spl.instructions.length === 2 && splData?.[0] === 12 && splData.readBigUInt64LE(1) === 10000000n && splData[9] === 6);
const sol = solanaTx.buildSolanaDepositTransaction({
  owner: payer,
  depositAddress: depositOwner,
  amount: '5000000',
  mint: null,
  decimals: 9,
  recentBlockhash: '11111111111111111111111111111111',
});
const solData = sol ? Buffer.from(sol.instructions[0].data) : null;
check('native sol transfer uses the quoted lamports', Boolean(sol) && sol.instructions.length === 1 && solData?.readUInt32LE(0) === 2 && solData.readBigUInt64LE(4) === 5000000n);
check('mainnet sol mint is not built', solanaTx.buildSolanaDepositTransaction({
  owner: payer,
  depositAddress: depositOwner,
  amount: '1',
  mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  decimals: 6,
  recentBlockhash: '11111111111111111111111111111111',
}) === null);

const solHash = '2uHptU4gNc2dZYLjJ7By6TGmdHF2rynGmTmkQ5uEd21GAmunxZaBHBSaZNjanhCe5ZfC128JXuFpzYyrL1dqaXXx';
const solParsed = origin.parseSolanaDeposit({
  meta: {
    err: null,
    preTokenBalances: [],
    postTokenBalances: [{ owner: depositOwner, mint, uiTokenAmount: { amount: '10000000' } }],
  },
}, { hash: solHash, depositAddress: depositOwner, amount: '10000000', mint });
check('matching solana credit is confirmed', solParsed.state === 'confirmed');
check('wrong solana amount is not confirmed', origin.parseSolanaDeposit({
  meta: { err: null, preTokenBalances: [], postTokenBalances: [{ owner: depositOwner, mint, uiTokenAmount: { amount: '1' } }] },
}, { hash: solHash, depositAddress: depositOwner, amount: '10000000', mint }).state === 'mismatch');
check('failed solana transaction is not confirmed', origin.parseSolanaDeposit({
  meta: { err: { InstructionError: [0, 'Custom'] } },
}, { hash: solHash, depositAddress: depositOwner, amount: '10000000', mint }).state === 'failed');
const devnetAccount = {
  address: payer,
  publicKey: new Uint8Array(32),
  chains: [origin.SOLANA_DEVNET_CHAIN, 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'],
  features: ['solana:signTransaction'],
};
const aliasAccount = { ...devnetAccount, chains: ['solana:devnet'] };
const mainnetAccount = { ...devnetAccount, chains: ['solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'] };
let seenSignInput = null;
const signedBytes = new Uint8Array(64).fill(7);
const returned = await solanaWallet.requestStandardSignature(async (input) => {
  seenSignInput = input;
  if (Array.isArray(input)) throw new Error('signTransaction was called with an array');
  if (input.transaction.constructor !== Uint8Array) throw new Error('transaction bytes were not a Uint8Array');
  return [{ signedTransaction: signedBytes }];
}, devnetAccount, Uint8Array.from([4, 5, 6]));
check('phantom sign request is one devnet object', seenSignInput && !Array.isArray(seenSignInput) && seenSignInput.chain === origin.SOLANA_DEVNET_CHAIN && seenSignInput.transaction instanceof Uint8Array);
check('signed bytes come back from the wallet standard result', returned instanceof Uint8Array && returned.length === 64 && returned[0] === 7);
check('phantom devnet alias is accepted', solanaWallet.solanaDevnetChain(aliasAccount.chains) === 'solana:devnet');
let mainnetRefused = false;
try {
  solanaWallet.walletStandardSignInput(mainnetAccount, new Uint8Array([1]));
} catch (error) {
  mainnetRefused = error instanceof Error && /not on solana devnet/i.test(error.message);
}
check('mainnet-only solana account is refused', mainnetRefused);
check('wallet standard failure keeps its reason', origin.explainOriginError({ message: 'Expected transaction to be a Uint8Array' }).includes('Uint8Array'));
check('missing signed transaction keeps its reason', origin.explainOriginError(new Error('The wallet did not return a signed transaction.')).includes('did not return a signed transaction'));
check('seed phrase is still refused', origin.explainOriginError(new Error('paste your seed phrase')).includes('will not ask for a seed phrase'));
check('declined wallet stays a decline', origin.explainOriginError({ code: 4001, message: 'User rejected the request.' }).includes('declined'));
const { Keypair } = await import('@solana/web3.js');
const freshOwner = Keypair.generate().publicKey.toBase58();
const prior = await rpc.findConfirmedSolanaDeposit({
  owner: freshOwner,
  depositAddress: depositOwner,
  amount: '1000000',
  mint,
});
check('an account with no signatures is not treated as already broadcast', prior === null);

const baseHash = `0x${'ab'.repeat(32)}`;
const baseMatch = origin.parseBaseDeposit({
  hash: baseHash,
  to: call.to,
  input: call.data,
  value: '0x0',
}, { status: '0x1' }, { ...call, hash: baseHash });
check('matching base receipt is confirmed', baseMatch.state === 'confirmed');
check('wrong base recipient is not confirmed', origin.parseBaseDeposit({
  hash: baseHash,
  to: call.to,
  input: origin.encodeErc20Transfer('0x3333333333333333333333333333333333333333', 10000000n),
  value: '0x0',
}, { status: '0x1' }, { ...call, hash: baseHash }).state === 'mismatch');
check('reverted base transaction is not confirmed', origin.parseBaseDeposit({
  hash: baseHash,
  to: call.to,
  input: call.data,
  value: '0x0',
}, { status: '0x0' }, { ...call, hash: baseHash }).state === 'failed');

const nearArgs = Buffer.from(JSON.stringify({
  receiver_id: plan.VERIFIER_ACCOUNT,
  amount: '1000000',
  msg: 'a'.repeat(64),
})).toString('base64');
const nearResult = {
  status: { SuccessValue: '' },
  transaction: {
    signer_id: 'alice.testnet',
    receiver_id: 'usdc.tidepool-sandbox.testnet',
    actions: [{ FunctionCall: { method_name: 'ft_transfer_call', args: nearArgs, deposit: '1' } }],
  },
};
check('matching near deposit is confirmed', origin.parseNearDeposit(nearResult, {
  hash: '11111111111111111111111111111111',
  signerId: 'alice.testnet',
  receiverId: 'usdc.tidepool-sandbox.testnet',
  amount: '1000000',
  depositAddress: 'a'.repeat(64),
}).state === 'confirmed');
check('near deposit with the wrong amount is not confirmed', origin.parseNearDeposit(nearResult, {
  hash: '11111111111111111111111111111111',
  signerId: 'alice.testnet',
  receiverId: 'usdc.tidepool-sandbox.testnet',
  amount: '2',
  depositAddress: 'a'.repeat(64),
}).state !== 'confirmed');

const lines = plan.depositLines({
  depositAddress: depositOwner,
  amountInFormatted: '10',
  originSymbol: 'USDC',
  originLabel: 'Solana devnet',
  depositType: 'ORIGIN_CHAIN',
  contractAddress: mint,
  originBlockchain: 'sol',
  depositMemo: null,
  deadline: null,
});
check('solana instructions mention an in-app wallet', lines.some((line) => /Phantom/.test(line)) && !lines.some((line) => /no Solana wallet/.test(line)));

let stayedOnMainnet = false;
let sentOnMainnet = false;
const switched = { chain: '0x1', sent: null };
try {
  await evm.sendBaseTransfer({
    async request({ method, params }) {
      if (method === 'eth_chainId') return switched.chain;
      if (method === 'wallet_switchEthereumChain') {
        stayedOnMainnet = params?.[0]?.chainId === '0x14a34';
        return null;
      }
      if (method === 'eth_sendTransaction') {
        sentOnMainnet = true;
        switched.sent = params?.[0];
      }
      return null;
    },
  }, '0x1111111111111111111111111111111111111111', baseQuote);
} catch (error) {
  stayedOnMainnet = stayedOnMainnet && /Base Sepolia/.test(error instanceof Error ? error.message : '');
}
check('a wallet that stays on mainnet cannot send', stayedOnMainnet && sentOnMainnet === false);

let addedSepolia = false;
let sentCall = null;
const sepolia = { chain: '0x1' };
const sentHash = await evm.sendBaseTransfer({
  async request({ method, params }) {
    if (method === 'eth_chainId') return sepolia.chain;
    if (method === 'eth_requestAccounts') return ['0x1111111111111111111111111111111111111111'];
    if (method === 'wallet_switchEthereumChain') {
      const error = new Error('missing chain');
      error.code = 4902;
      throw error;
    }
    if (method === 'wallet_addEthereumChain') {
      addedSepolia = params?.[0]?.chainId === '0x14a34' && params[0].chainName === 'Base Sepolia';
      sepolia.chain = '0x14a34';
      return null;
    }
    if (method === 'eth_sendTransaction') {
      sentCall = params?.[0];
      return `0x${'cd'.repeat(32)}`;
    }
    return null;
  },
}, '0x1111111111111111111111111111111111111111', baseQuote);
check('missing Base Sepolia is added and the transfer matches the quote', addedSepolia && sentHash === `0x${'cd'.repeat(32)}` && sentCall?.to === call.to && sentCall.data === call.data && sentCall.value === '0x0');

let catalog;
try {
  catalog = await tide.tidepoolCatalog();
  check('token list comes from Tidepool', catalog.provider === 'Tidepool' && catalog.mainnet === false && catalog.stakeableNativeNear === false);
  check('native NEAR is not listed', catalog.nativeNearAssetListed === false);
  const chains = catalog.chains.map((chain) => chain.id);
  check('solana and base are listed', chains.includes('sol') && chains.includes('base') && chains.includes('near'), chains.join(','));
  const sol = catalog.tokens.find((token) => token.blockchain === 'sol' && token.symbol === 'USDC');
  const base = catalog.tokens.find((token) => token.blockchain === 'base' && token.symbol === 'USDC');
  const near = catalog.tokens.find((token) => token.blockchain === 'near' && token.symbol === 'wNEAR');
  check('solana USDC and test wNEAR are present', Boolean(sol && near), sol?.assetId ?? 'missing sol');
  check('listed assets are testnet ids', catalog.tokens.every((token) => token.assetId.endsWith('.testnet')));

  if (sol && near) {
    const dry = await tide.tidepoolQuote({
      dry: true,
      originAsset: sol.assetId,
      destinationAsset: near.assetId,
      amount: '10',
      refundTo: '13QkxhNMrTPxoCkRdYdJ65tFuwXPhL5gLS2Z5Nr6gjRK',
      recipient: 'alice.testnet',
    });
    check('dry quote has an output and no deposit address', dry.dry === true && dry.depositAddress === null && dry.amountInFormatted === '10' && Number(dry.amountOutFormatted) > 0, dry.amountOutFormatted);
    check('dry quote includes the value fields', Boolean(dry.amountInUsd && dry.amountOutUsd && dry.quotedValueGap), `${dry.amountInUsd} -> ${dry.amountOutUsd} gap ${dry.quotedValueGap}`);
    console.log(`dry 10 sol USDC -> ${dry.amountOutFormatted} ${dry.destinationSymbol}; gap ${dry.quotedValueGap} USD; estimate ${dry.timeEstimate}s`);
  }

  if (base && near) {
    const baseQuote = await tide.tidepoolQuote({
      dry: true,
      originAsset: base.assetId,
      destinationAsset: near.assetId,
      amount: '25',
      refundTo: '0x1111111111111111111111111111111111111111',
      recipient: 'alice.testnet',
    });
    check('base sepolia dry quote returns an output', baseQuote.amountInFormatted === '25' && Number(baseQuote.amountOutFormatted) > 0 && baseQuote.depositAddress === null, baseQuote.amountOutFormatted);
    console.log(`dry 25 base USDC -> ${baseQuote.amountOutFormatted} ${baseQuote.destinationSymbol}; expires in quote: ${baseQuote.deadline ?? 'not issued'}`);
  }

  if (sol && near) {
    const live = await tide.tidepoolQuote({
      dry: false,
      originAsset: sol.assetId,
      destinationAsset: near.assetId,
      amount: '1',
      refundTo: '13QkxhNMrTPxoCkRdYdJ65tFuwXPhL5gLS2Z5Nr6gjRK',
      recipient: 'near-easy-status.testnet',
    });
    check('live quote prepares a deposit address and expiration', Boolean(live.depositAddress && live.deadline) && live.dry === false, live.deadline ?? '');
    const status = await tide.tidepoolStatus(live.depositAddress, live.depositMemo ?? '');
    check('new deposit is pending, not success', status.status === 'PENDING_DEPOSIT' && status.terminal === false && status.hashes.length === 0, status.status);
    console.log(`live deposit ${live.depositAddress} status ${status.status} deadline ${live.deadline}`);
  }

  let rejected = false;
  try {
    await tide.tidepoolQuote({
      dry: true,
      originAsset: sol.assetId,
      destinationAsset: near.assetId,
      amount: '1',
      refundTo: '13QkxhNMrTPxoCkRdYdJ65tFuwXPhL5gLS2Z5Nr6gjRK',
      recipient: 'alice.near',
    });
  } catch (error) {
    rejected = error instanceof tide.FundingError && error.status === 400;
  }
  check('mainnet recipient is rejected before a quote', rejected);

  let unknown = 'no result';
  try {
    const status = await tide.tidepoolStatus('not-a-real-deposit-address');
    unknown = status.status;
  } catch (error) {
    unknown = error instanceof Error ? error.message : 'threw';
  }
  check('unknown deposit does not look successful', !/SUCCESS|PENDING_DEPOSIT/.test(unknown), unknown);

  const solChain = await rpc.verifySolanaDeposit(solHash, { depositAddress: depositOwner, amount: '10000000', mint });
  check('unknown solana signature is not success', solChain.state !== 'confirmed', solChain.state);
  const baseChain = await rpc.verifyBaseDeposit(baseHash, baseQuote);
  check('unknown base hash is not success', baseChain.state !== 'confirmed', baseChain.state);
  const wnear = await rpc.readWnearLimitation();
  check('test wNEAR cannot convert into native NEAR', wnear.convertible === false && wnear.methodFound === false && wnear.wrapMethodFound === true && wnear.backed === false && wnear.codeHash !== wnear.wrapCodeHash, wnear.detail);
  console.log(`wNEAR limitation: ${wnear.detail}`);
} catch (error) {
  check('live Tidepool calls', false, error instanceof Error ? error.message : String(error));
}

await server.close();
if (failures.length) {
  console.error(`${failures.length} failed`);
  process.exit(1);
}
console.log('funding checks passed');
