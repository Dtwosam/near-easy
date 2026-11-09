import type { FundingCatalog, FundingStatus, PublicQuote } from './plan';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null) as { error?: unknown } & T;
  if (!response.ok) {
    const message = body && typeof body.error === 'string' ? body.error : 'The funding service could not be reached.';
    throw new Error(message);
  }
  return body;
}

export function loadFundingCatalog(signal?: AbortSignal): Promise<FundingCatalog> {
  return request('/api/funding/tokens', { signal });
}

export function requestFundingQuote(input: {
  dry: boolean;
  originAsset: string;
  destinationAsset: string;
  amount: string;
  refundTo: string;
  recipient: string;
}, signal?: AbortSignal): Promise<PublicQuote> {
  return request('/api/funding/quote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
}

export function loadFundingStatus(depositAddress: string, depositMemo: string | null, signal?: AbortSignal): Promise<FundingStatus> {
  const params = new URLSearchParams({ depositAddress });
  if (depositMemo) params.set('depositMemo', depositMemo);
  return request(`/api/funding/status?${params.toString()}`, { signal });
}

export function submitFundingDeposit(input: {
  txHash: string;
  depositAddress: string;
  memo?: string | null;
  nearSenderAccount?: string | null;
}): Promise<FundingStatus> {
  return request('/api/funding/deposit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      txHash: input.txHash,
      depositAddress: input.depositAddress,
      memo: input.memo ?? '',
      nearSenderAccount: input.nearSenderAccount ?? '',
    }),
  });
}

export async function requestTestTokens(input: { chain?: string; address?: string; accountId?: string }): Promise<string> {
  const body = await request<{ detail: string }>('/api/funding/faucet', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return typeof body.detail === 'string' ? body.detail : 'Tidepool answered the faucet request.';
}
