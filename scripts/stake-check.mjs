import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

const plan = await server.ssrLoadModule('/src/near/stakePlan.ts');
const chain = await server.ssrLoadModule('/src/near/stakeChain.ts');
const send = await server.ssrLoadModule('/src/near/stakeSend.ts');
const logic = await server.ssrLoadModule('/src/logic.ts');

const failures = [];
function check(name, ok, detail = '') {
  const line = `${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`;
  console.log(line);
  if (!ok) failures.push(line);
}

check('commission 6/100', plan.formatCommission(6n, 100n) === '6%');
check('commission 99/100', plan.formatCommission(99n, 100n) === '99%');
check('commission rejects inverted fraction', plan.formatCommission(3n, 2n) === null);
check('fee json', plan.parseFeeFraction('{"numerator":9,"denominator":100}')?.numerator === 9n);

const available = 2n * 10n ** 24n;
const stakeable = plan.stakeableYocto(available);
check('reserve 0.05', available - stakeable === plan.FEE_RESERVE_YOCTO);
check('below reserve cannot stake', plan.stakeableYocto(plan.FEE_RESERVE_YOCTO) === 0n);

const call = plan.stakeCall(10n ** 24n);
check('deposit_and_stake has no args', call.params.methodName === 'deposit_and_stake' && Object.keys(call.params.args).length === 0);
check('deposit matches amount', call.params.deposit === (10n ** 24n).toString());
check('gas is 300 TGas', call.params.gas === '300000000000000');
check('mainnet staking stays disabled', plan.stakingEnabled('mainnet') === false && plan.stakingEnabled('testnet') === true);
check('stake ask parses 5', logic.parseStakeAsk('Stake 5 NEAR') === '5');
check('unstake does not fill a stake amount', logic.parseStakeAsk('Unstake 5 NEAR') === null);

const amount = 10n ** 24n;
const tx = {
  status: { SuccessValue: '' },
  transaction: {
    hash: '11111111111111111111111111111111',
    signer_id: 'alice.testnet',
    receiver_id: 'aurora.pool.f863973.m0',
    actions: [{ FunctionCall: { method_name: 'deposit_and_stake', deposit: amount.toString() } }],
  },
  receipts_outcome: [{ outcome: { status: { SuccessValue: '' } } }],
};
check('hash read', plan.transactionHash(tx) === '11111111111111111111111111111111');
check('success status', plan.chainSucceeded(tx) === true);
check('action match', plan.stakeActionMatches(tx, 'aurora.pool.f863973.m0', 'alice.testnet', amount) === true);
check('wrong pool rejected', plan.stakeActionMatches(tx, 'other.pool.testnet', 'alice.testnet', amount) === false);
check('failure status rejected', plan.chainSucceeded({ status: { Failure: { ActionError: {} } } }) === false);
check('balance must increase', plan.stakeRecorded(0n, amount, amount) === true);
check('flat balance is not success', plan.stakeRecorded(amount, amount, amount) === false);
check('declined wallet', plan.explainStakeError(new Error('User rejected')).kind === 'rejected');
check('missing wallet', /No wallet is connected/.test(plan.explainStakeError(new Error('No wallet selected')).message));

let mainnetBlocked = false;
try {
  await send.requestStakeSignature({ network: 'mainnet', signerId: 'alice.near', poolId: 'figment.poolv1.near', amountYocto: amount });
} catch (error) {
  mainnetBlocked = error instanceof Error && error.message === 'Mainnet staking is not enabled.';
}
check('mainnet signature is refused before a wallet opens', mainnetBlocked);

try {
  const pools = await chain.loadStakePools('testnet');
  console.log(pools.map((pool) => `${pool.id} ${pool.commission} stake ${pool.poolStake}`).join('\n'));
  const aurora = pools.find((pool) => pool.id === 'aurora.pool.f863973.m0');
  check('testnet pools loaded', pools.length > 0, String(pools.length));
  check('aurora commission is 9%', aurora?.commission === '9%', aurora ? `${aurora.id} ${aurora.commission}` : 'missing');
  check('every pool has a commission', pools.every((pool) => /^\d+(?:\.\d+)?%$/.test(pool.commission)));
} catch (error) {
  check('testnet pools loaded', false, error instanceof Error ? error.message : String(error));
}

await server.close();
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nStake checks passed');
