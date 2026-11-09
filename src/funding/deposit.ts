import { getConnector } from '../near/connector';
import type { NearDeposit } from './plan';

/**
 * Asks the connected NEAR testnet wallet to sign one ft_transfer_call.
 * NEAR Easy never sees a seed phrase or a private key, and it does not sign by itself.
 */
export async function requestFundingSignature(input: { signerId: string; deposit: NearDeposit }): Promise<unknown> {
  const { wallet } = await getConnector('testnet').getConnectedWallet();
  const accounts = await wallet.getAccounts({ network: 'testnet' });
  const ids = accounts.map((account) => account.accountId.trim().toLowerCase());
  if (!ids.includes(input.signerId)) {
    throw new Error('The connected wallet does not match this account.');
  }
  return wallet.signAndSendTransaction({
    network: 'testnet',
    signerId: input.signerId,
    receiverId: input.deposit.receiverId,
    actions: [{
      type: 'FunctionCall',
      params: {
        methodName: input.deposit.methodName,
        args: input.deposit.args,
        gas: input.deposit.gas,
        deposit: input.deposit.deposit,
      },
    }],
  });
}

export function explainFundingError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const lower = message.toLowerCase();
  if (/reject|denied|cancel|closed|dismiss|user rejected/.test(lower)) {
    return 'The wallet declined the deposit. Nothing was confirmed.';
  }
  if (/does not match/.test(lower)) {
    return 'The connected wallet does not match this account. Nothing was submitted.';
  }
  if (/not connected|no accounts|sign in|no wallet selected|wallet not found/.test(lower)) {
    return 'No testnet wallet is connected. Nothing was submitted.';
  }
  if (/timeout|failed to fetch|network|could not be reached|manifest/.test(lower)) {
    return 'The wallet or network could not be reached. Nothing was confirmed.';
  }
  return 'The deposit could not be submitted. Nothing was confirmed.';
}
