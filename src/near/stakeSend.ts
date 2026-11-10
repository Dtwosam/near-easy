import { getConnector } from './connector';
import type { NetworkId } from './chain';
import { confirmStake, readAccountStaked } from './stakeChain';
import { explainStakeError, stakeCall, stakingEnabled, transactionHash } from './stakePlan';

/**
 * Asks the connected HOT wallet to sign deposit_and_stake.
 * NEAR Easy never sees a seed phrase or a private key, and it does not sign by itself.
 */
export async function requestStakeSignature(input: {
  network: NetworkId;
  signerId: string;
  poolId: string;
  amountYocto: bigint;
}): Promise<unknown> {
  if (!stakingEnabled(input.network)) {
    throw new Error('Mainnet staking is not enabled.');
  }
  const { wallet } = await getConnector(input.network).getConnectedWallet();
  const accounts = await wallet.getAccounts({ network: input.network });
  const ids = accounts.map((account) => account.accountId.trim().toLowerCase());
  if (!ids.includes(input.signerId)) {
    throw new Error('The connected wallet does not match this account.');
  }
  return wallet.signAndSendTransaction({
    network: input.network,
    signerId: input.signerId,
    receiverId: input.poolId,
    actions: [stakeCall(input.amountYocto)],
  });
}

/**
 * The staking page and the assistant both use this path.
 * It signs only through HOT Connect, then reports success only after NEAR finalizes the stake.
 */
export async function executeStake(input: {
  network: NetworkId;
  signerId: string;
  poolId: string;
  amountYocto: bigint;
}): Promise<
  | { ok: true; hash: string; stakedYocto: bigint }
  | { ok: false; kind: 'rejected' | 'failed' | 'network' | 'unconfirmed'; hash: string | null; message: string }
> {
  if (!stakingEnabled(input.network)) {
    return { ok: false, kind: 'failed', hash: null, message: 'Mainnet staking is not enabled. Nothing was submitted.' };
  }
  if (input.amountYocto <= 0n) {
    return { ok: false, kind: 'failed', hash: null, message: 'Enter a stake amount greater than zero. Nothing was submitted.' };
  }
  try {
    const previous = await readAccountStaked(input.network, input.poolId, input.signerId);
    const outcome = await requestStakeSignature(input);
    const confirmed = await confirmStake({
      network: input.network,
      hash: transactionHash(outcome),
      signerId: input.signerId,
      poolId: input.poolId,
      amountYocto: input.amountYocto,
      previousStakedYocto: previous,
    });
    if (!confirmed.ok) return { ok: false, kind: confirmed.kind, hash: confirmed.hash, message: confirmed.message };
    return confirmed;
  } catch (error) {
    const explained = explainStakeError(error);
    return { ok: false, kind: explained.kind, hash: null, message: explained.message };
  }
}
