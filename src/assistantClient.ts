import type { AssistantAction, AssistantRequest } from './assistantContract';

const ACTIONS = new Set<AssistantAction>(['none', 'wallet', 'stake', 'fund', 'fund-stake', 'explore', 'start']);

export async function requestAssistant(input: AssistantRequest, signal: AbortSignal): Promise<{ reply: string; action: AssistantAction }> {
  let response: Response;
  try {
    response = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new Error('The assistant could not be reached. Check that the app server is running.');
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const serverError = payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
    ? (payload as { error: string }).error
    : '';
  if (!response.ok) throw new Error(serverError || 'The assistant could not answer. Nothing was changed.');

  const reply = payload && typeof payload === 'object' ? (payload as { reply?: unknown }).reply : null;
  const action = payload && typeof payload === 'object' ? (payload as { action?: unknown }).action : null;
  if (typeof reply !== 'string' || !reply.trim() || typeof action !== 'string' || !ACTIONS.has(action as AssistantAction)) {
    throw new Error('The assistant returned an answer that did not match the expected form.');
  }
  return { reply: reply.trim(), action: action as AssistantAction };
}

export async function assistantConfigured(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch('/api/assistant', { signal });
    if (!response.ok) return false;
    const payload = await response.json() as { configured?: unknown };
    return payload.configured === true;
  } catch {
    return false;
  }
}
