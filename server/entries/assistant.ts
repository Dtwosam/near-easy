import { handleAssistantHttp } from '../assistantHandler';
import { clientIp, rawBody, send } from '../http';
import type { ApiRequest, ApiResponse } from '../http';

export const config = { maxDuration: 60 };

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const method = req.method ?? 'GET';
  const key = process.env.GEMINI_API_KEY?.trim() ?? '';
  const result = await handleAssistantHttp({
    method,
    rawBody: method === 'POST' ? rawBody(req.body) : '',
    ip: clientIp(req),
    key,
  });
  send(res, result.status, result.body);
}
