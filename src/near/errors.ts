export function explainWalletError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const lower = message.toLowerCase();
  if (/reject|denied|cancel|closed|dismiss/.test(lower)) {
    return 'The wallet request was declined. Nothing was connected.';
  }
  if (/no accounts|failed to sign in/.test(lower)) {
    return 'The wallet did not return an account.';
  }
  if (/timeout|failed to fetch|network|manifest|could not be reached/.test(lower)) {
    return 'The wallet or network could not be reached. Check your connection and try again.';
  }
  const clean = message.replace(/\s+/g, ' ').trim();
  if (!clean || /seed|mnemonic|private key/i.test(clean)) {
    return 'The wallet could not connect. Nothing was connected.';
  }
  return clean.slice(0, 160);
}

export function explainChainError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('The NEAR network') || message.startsWith('The wallet returned')) return message;
  return 'The NEAR network could not be reached. Check your connection and try again.';
}
