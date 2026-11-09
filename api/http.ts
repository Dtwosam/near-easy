export type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
  socket?: { remoteAddress?: string };
};

export type ApiResponse = {
  status: (code: number) => ApiResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
};

export function send(res: ApiResponse, status: number, body: unknown) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

export function clientIp(req: ApiRequest): string {
  const real = req.headers['x-real-ip'];
  const realIp = Array.isArray(real) ? real[0] : real;
  if (realIp?.trim()) return realIp.trim().slice(0, 64);
  const forwarded = req.headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = value?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  return ip.slice(0, 64);
}

export function rawBody(body: unknown): string {
  if (body == null || body === '') return '';
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  return JSON.stringify(body);
}
