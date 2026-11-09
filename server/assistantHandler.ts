import { ApiError, GoogleGenAI } from '@google/genai';
import { buildSystemPrompt, guardReply, parseModelReply, sanitizeRequest, toGeminiContents } from '../src/assistantContract';
import { allowAssistantCall } from './rateLimit';

const MODEL = 'gemini-3.5-flash-lite';
export const ASSISTANT_BODY_LIMIT = 48_000;
/** Short pauses before repeating a temporary Gemini failure. 429 is never retried. */
const RETRY_DELAYS_MS = [400, 1200];

const replyJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reply: { type: 'string' },
    action: {
      type: 'string',
      enum: ['none', 'wallet', 'stake', 'fund', 'fund-stake', 'explore', 'start'],
    },
  },
  required: ['reply', 'action'],
};

function geminiStatus(error: unknown): number {
  return error instanceof ApiError ? error.status : 0;
}

function geminiReason(error: unknown): string {
  if (!(error instanceof Error)) return '';
  try {
    const parsed = JSON.parse(error.message) as { error?: { status?: unknown } };
    const reason = parsed.error?.status;
    return typeof reason === 'string' && /^[A-Z0-9_]+$/.test(reason) ? reason : '';
  } catch {
    return '';
  }
}

function retryable(error: unknown): boolean {
  const status = geminiStatus(error);
  if (status === 429) return false;
  if (status === 500 || status === 502 || status === 503 || status === 504) return true;
  if (status !== 0 || !(error instanceof Error)) return false;
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return false;
  return /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|network/i.test(error.message);
}

function explainGemini(error: unknown): string {
  const status = geminiStatus(error);
  const reason = geminiReason(error);
  const kept = 'Your question is still in this chat.';
  if (status === 429 || reason === 'RESOURCE_EXHAUSTED') {
    const daily = error instanceof Error && /per day|daily/i.test(error.message);
    return daily
      ? `The free-tier daily limit was reached. Try again after it resets. ${kept} Nothing was changed.`
      : `The free-tier rate limit was reached. Wait a minute and try again. ${kept} Nothing was changed.`;
  }
  if (status === 503 || reason === 'UNAVAILABLE') {
    return `The assistant is busy because Gemini is in high demand. This is usually temporary. ${kept} Wait a moment and try again. Nothing was changed.`;
  }
  if (status === 404) return `The assistant model is unavailable right now. ${kept} Nothing was changed.`;
  if (status === 401 || status === 403) return `The assistant could not sign in to the model. Check the server API key. ${kept}`;
  if (status === 408 || status === 504) return `The model took too long to answer. ${kept} Try again.`;
  return `The model could not be reached. ${kept} Nothing was changed.`;
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new DOMException('aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal.reason instanceof Error ? signal.reason : new DOMException('aborted', 'AbortError'));
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function logGeminiFailure(error: unknown, attempt: number) {
  const status = geminiStatus(error);
  const reason = geminiReason(error) || (error instanceof Error ? error.name : 'Error');
  console.warn(`[assistant] Gemini request failed (${reason}${status ? ` HTTP ${status}` : ''}) on attempt ${attempt}.`);
}

async function generateReply(key: string, request: { mode: 'simple' | 'advanced'; messages: { role: 'user' | 'assistant'; text: string }[]; wallet: Parameters<typeof buildSystemPrompt>[1] }, signal: AbortSignal) {
  const ai = new GoogleGenAI({ apiKey: key });
  const contents = toGeminiContents(request.messages);
  const systemInstruction = buildSystemPrompt(request.mode, request.wallet);
  // thinkingBudget is omitted. This model rejects thinkingBudget: 0 with HTTP 400, and that extra call was spending free-tier quota before the real request.
  const config = {
    systemInstruction,
    responseMimeType: 'application/json',
    responseJsonSchema: replyJsonSchema,
    maxOutputTokens: 1024,
    temperature: 0.2,
    abortSignal: signal,
  };
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await ai.models.generateContent({ model: MODEL, contents, config });
    } catch (error) {
      lastError = error;
      logGeminiFailure(error, attempt + 1);
      if (!retryable(error) || attempt === RETRY_DELAYS_MS.length) throw error;
      await wait(RETRY_DELAYS_MS[attempt], signal);
    }
  }
  throw lastError;
}

export async function handleAssistantHttp(input: {
  method: string;
  rawBody: string;
  ip: string;
  key: string;
}): Promise<{ status: number; body: unknown }> {
  if (input.method === 'GET') return { status: 200, body: { configured: Boolean(input.key) } };
  if (input.method !== 'POST') return { status: 405, body: { error: 'This assistant route accepts POST.' } };
  if (!input.key) {
    return { status: 503, body: { error: 'The assistant is not configured. An API key is not available on the server.' } };
  }
  if (input.rawBody.length > ASSISTANT_BODY_LIMIT) return { status: 413, body: { error: 'That message is too long.' } };
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(input.rawBody);
  } catch {
    return { status: 400, body: { error: 'The request could not be read.' } };
  }
  const request = sanitizeRequest(parsedBody);
  if ('error' in request) return { status: 400, body: { error: request.error } };
  const slot = allowAssistantCall(input.ip);
  if (!slot.ok) return { status: 429, body: { error: slot.message } };
  try {
    const signal = AbortSignal.timeout(45_000);
    const response = await generateReply(input.key, request, signal);
    const parsed = response.text ? parseModelReply(response.text) : null;
    if (!parsed) return { status: 502, body: { error: 'The model did not return a usable answer. Nothing was changed.' } };
    return { status: 200, body: { reply: guardReply(parsed.reply, request.wallet), action: parsed.action } };
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') {
      return { status: 504, body: { error: 'The model took too long to answer. Try again.' } };
    }
    return { status: 502, body: { error: explainGemini(error) } };
  }
}
