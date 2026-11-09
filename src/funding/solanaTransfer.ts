import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { assertSolanaDevnetRpc, SOLANA_DEVNET_RPC } from './originPlan';

const REFUSED_SOL_MINTS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
]);

export function buildSolanaDepositTransaction(input: {
  owner: string;
  depositAddress: string;
  amount: string;
  mint: string | null;
  decimals: number;
  recentBlockhash: string;
}): Transaction | null {
  if (!/^\d+$/.test(input.amount) || input.amount === '0') return null;
  if (!Number.isInteger(input.decimals) || input.decimals < 0 || input.decimals > 18) return null;
  if (input.mint && REFUSED_SOL_MINTS.has(input.mint)) return null;
  try {
    const owner = new PublicKey(input.owner);
    const deposit = new PublicKey(input.depositAddress);
    const amount = BigInt(input.amount);
    const tx = new Transaction();
    tx.feePayer = owner;
    tx.recentBlockhash = input.recentBlockhash;
    if (input.mint) {
      const mint = new PublicKey(input.mint);
      const source = getAssociatedTokenAddressSync(mint, owner);
      const destination = getAssociatedTokenAddressSync(mint, deposit);
      tx.add(createAssociatedTokenAccountIdempotentInstruction(owner, destination, deposit, mint));
      tx.add(createTransferCheckedInstruction(source, mint, destination, owner, amount, input.decimals));
    } else {
      tx.add(SystemProgram.transfer({ fromPubkey: owner, toPubkey: deposit, lamports: amount }));
    }
    return tx;
  } catch {
    return null;
  }
}

export async function recentDevnetBlockhash(): Promise<string> {
  assertSolanaDevnetRpc(SOLANA_DEVNET_RPC);
  const connection = new Connection(SOLANA_DEVNET_RPC, 'confirmed');
  const latest = await connection.getLatestBlockhash('confirmed');
  return latest.blockhash;
}

export async function sendSignedSolanaTransaction(raw: Uint8Array): Promise<string> {
  assertSolanaDevnetRpc(SOLANA_DEVNET_RPC);
  const connection = new Connection(SOLANA_DEVNET_RPC, 'confirmed');
  return connection.sendRawTransaction(raw, { skipPreflight: false, preflightCommitment: 'confirmed' });
}
