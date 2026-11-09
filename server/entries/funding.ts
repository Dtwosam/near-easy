import { handleFundingHttp } from '../fundingHandler';
import { rawBody, send } from '../http';
import type { ApiRequest, ApiResponse } from '../http';

export const config = { maxDuration: 30 };

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const route = typeof req.query?.route === 'string' ? req.query.route : '';
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query ?? {})) {
    if (key === 'route' || typeof value !== 'string') continue;
    query.set(key, value);
  }
  const method = req.method ?? 'GET';
  const result = await handleFundingHttp({
    method,
    route,
    query,
    rawBody: method === 'POST' ? rawBody(req.body) : '',
  });
  send(res, result.status, result.body);
}
