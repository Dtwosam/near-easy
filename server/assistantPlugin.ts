import type { Connect, Plugin } from 'vite';
import { loadEnv } from 'vite';
import { ASSISTANT_BODY_LIMIT, handleAssistantHttp } from './assistantHandler';

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

function readKey(mode: string, envDir: string): string {
  const fromProcess = process.env.GEMINI_API_KEY?.trim();
  if (fromProcess) return fromProcess;
  try {
    return loadEnv(mode, envDir || process.cwd(), '').GEMINI_API_KEY?.trim() ?? '';
  } catch {
    return '';
  }
}

async function readBody(req: Connect.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > ASSISTANT_BODY_LIMIT) {
      req.destroy();
      throw new Error('too_large');
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function attach(middlewares: Connect.Server, mode: string, envDir: string) {
  middlewares.use(async (req, res, next) => {
    const url = req.url?.split('?')[0];
    if (url !== '/api/assistant') {
      next();
      return;
    }
    try {
      const key = readKey(mode, envDir);
      let rawBody = '';
      if (req.method === 'POST') {
        try {
          rawBody = await readBody(req);
        } catch (error) {
          const tooLarge = error instanceof Error && error.message === 'too_large';
          sendJson(res, tooLarge ? 413 : 400, { error: tooLarge ? 'That message is too long.' : 'The request could not be read.' });
          return;
        }
      }
      const result = await handleAssistantHttp({
        method: req.method ?? 'GET',
        rawBody,
        ip: req.socket.remoteAddress ?? 'local',
        key,
      });
      sendJson(res, result.status, result.body);
    } catch {
      if (!res.writableEnded) {
        sendJson(res, 502, { error: 'The model could not be reached. Your question is still in this chat. Nothing was changed.' });
      }
    }
  });
}

export function assistantPlugin(): Plugin {
  return {
    name: 'near-easy-assistant',
    configureServer(server) {
      attach(server.middlewares, server.config.mode, server.config.envDir || process.cwd());
    },
    configurePreviewServer(server) {
      attach(server.middlewares, server.config.mode, server.config.envDir || process.cwd());
    },
  };
}
