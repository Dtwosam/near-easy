import { explainTidepool, tidepoolCatalog, tidepoolFaucet, tidepoolQuote, tidepoolStatus, tidepoolSubmit } from '../src/funding/tidepoolServer';

export const FUNDING_BODY_LIMIT = 16_000;

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function handleFundingHttp(input: {
  method: string;
  route: string;
  query: URLSearchParams;
  rawBody: string;
}): Promise<{ status: number; body: unknown }> {
  let parsed: Record<string, unknown> | null = null;
  if (input.method === 'POST') {
    if (input.rawBody.length > FUNDING_BODY_LIMIT) return { status: 413, body: { error: 'That request is too long.' } };
    try {
      const value = JSON.parse(input.rawBody) as unknown;
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { status: 400, body: { error: 'The funding request could not be read.' } };
      }
      parsed = value as Record<string, unknown>;
    } catch {
      return { status: 400, body: { error: 'The funding request could not be read.' } };
    }
  }
  try {
    if (input.route === 'tokens' && input.method === 'GET') return { status: 200, body: await tidepoolCatalog() };
    if (input.route === 'quote' && input.method === 'POST' && parsed) {
      return {
        status: 200,
        body: await tidepoolQuote({
          dry: parsed.dry !== false,
          originAsset: text(parsed.originAsset),
          destinationAsset: text(parsed.destinationAsset),
          amount: text(parsed.amount),
          refundTo: text(parsed.refundTo),
          recipient: text(parsed.recipient),
        }),
      };
    }
    if (input.route === 'status' && input.method === 'GET') {
      return { status: 200, body: await tidepoolStatus(input.query.get('depositAddress') ?? '', input.query.get('depositMemo') ?? '') };
    }
    if (input.route === 'deposit' && input.method === 'POST' && parsed) {
      return {
        status: 200,
        body: await tidepoolSubmit({
          txHash: text(parsed.txHash),
          depositAddress: text(parsed.depositAddress),
          memo: text(parsed.memo),
          nearSenderAccount: text(parsed.nearSenderAccount),
        }),
      };
    }
    if (input.route === 'faucet' && input.method === 'POST' && parsed) {
      const detail = await tidepoolFaucet({
        chain: text(parsed.chain),
        address: text(parsed.address),
        accountId: text(parsed.accountId),
      });
      return { status: 200, body: { detail } };
    }
    return { status: 404, body: { error: 'That funding route is not available.' } };
  } catch (error) {
    const explained = explainTidepool(error);
    return { status: explained.status, body: { error: explained.message } };
  }
}
