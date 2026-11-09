/** Best-effort guard for the free Gemini quota. Each server process keeps its own window. */

const PER_IP_PER_MINUTE = 5;
const PER_IP_PER_DAY = 30;
const GLOBAL_PER_MINUTE = 8;
const MINUTE = 60_000;
const DAY = 86_400_000;

const byIp = new Map<string, number[]>();
const globalStamps: number[] = [];

export function resetAssistantLimits(): void {
  byIp.clear();
  globalStamps.length = 0;
}

export function allowAssistantCall(ip: string, now = Date.now()): { ok: true } | { ok: false; message: string } {
  const key = ip.trim() || 'unknown';
  const minuteAgo = now - MINUTE;
  const dayAgo = now - DAY;
  const stamps = (byIp.get(key) ?? []).filter((time) => time > dayAgo);
  const kept = 'Your question is still in this chat.';
  if (stamps.filter((time) => time > minuteAgo).length >= PER_IP_PER_MINUTE) {
    byIp.set(key, stamps);
    return { ok: false, message: `The free-tier rate limit was reached. Wait a minute and try again. ${kept} Nothing was changed.` };
  }
  if (stamps.length >= PER_IP_PER_DAY) {
    byIp.set(key, stamps);
    return { ok: false, message: `The free-tier daily limit was reached. Try again after it resets. ${kept} Nothing was changed.` };
  }
  while (globalStamps.length > 0 && globalStamps[0] <= minuteAgo) globalStamps.shift();
  if (globalStamps.length >= GLOBAL_PER_MINUTE) {
    byIp.set(key, stamps);
    return { ok: false, message: `The free-tier rate limit was reached. Wait a minute and try again. ${kept} Nothing was changed.` };
  }
  stamps.push(now);
  byIp.set(key, stamps);
  globalStamps.push(now);
  if (byIp.size > 2000) {
    const oldest = byIp.keys().next().value;
    if (oldest) byIp.delete(oldest);
  }
  return { ok: true };
}
