import { getConnector } from './connector';
import type { NetworkId } from './chain';
import { stakeCall, stakingEnabled } from './stakePlan';

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
