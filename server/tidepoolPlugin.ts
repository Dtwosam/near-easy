import type { Connect, Plugin } from 'vite';
import { FUNDING_BODY_LIMIT, handleFundingHttp } from './fundingHandler';

type NodeRes = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
  writableEnded?: boolean;
};

function sendJson(res: NodeRes, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req: Connect.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > FUNDING_BODY_LIMIT) {
      req.destroy();
      throw new Error('too_large');
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function attach(middlewares: Connect.Server) {
  middlewares.use(async (req, res, next) => {
    const [path, query = ''] = (req.url ?? '').split('?');
    if (!path.startsWith('/api/funding/')) {
      next();
      return;
    }
    const route = path.slice('/api/funding/'.length);
    try {
      let rawBody = '';
      if (req.method === 'POST') {
        try {
          rawBody = await readBody(req);
        } catch (error) {
          const tooLarge = error instanceof Error && error.message === 'too_large';
          sendJson(res, tooLarge ? 413 : 400, { error: tooLarge ? 'That request is too long.' : 'The funding request could not be read.' });
          return;
        }
      }
      const result = await handleFundingHttp({
        method: req.method ?? 'GET',
        route,
        query: new URLSearchParams(query),
        rawBody,
      });
      sendJson(res, result.status, result.body);
    } catch {
      if (!res.writableEnded) sendJson(res, 502, { error: 'Tidepool could not be reached.' });
    }
  });
}

export function tidepoolPlugin(): Plugin {
  return {
    name: 'near-easy-tidepool',
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
  };
}
