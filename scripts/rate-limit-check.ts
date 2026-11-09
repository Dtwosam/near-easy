import { allowAssistantCall, resetAssistantLimits } from '../server/rateLimit.ts';

const minute = 'Wait a minute';
const day = 'daily limit';
let failed = 0;

function check(name: string, ok: boolean) {
  if (ok) {
    console.log(`ok ${name}`);
    return;
  }
  failed += 1;
  console.error(`fail ${name}`);
}

const start = Date.parse('2026-11-09T12:00:00Z');
resetAssistantLimits();
for (let i = 0; i < 5; i += 1) check(`minute allow ${i + 1}`, allowAssistantCall('10.0.0.1', start).ok);
const sixth = allowAssistantCall('10.0.0.1', start);
check('minute block', !sixth.ok && sixth.message.includes(minute));
check('minute other ip', allowAssistantCall('10.0.0.2', start).ok);
check('next minute', allowAssistantCall('10.0.0.1', start + 60_000).ok);

resetAssistantLimits();
for (let i = 0; i < 30; i += 1) {
  const at = start + Math.floor(i / 5) * 60_000;
  check(`day allow ${i + 1}`, allowAssistantCall('10.0.0.8', at).ok);
}
const overDay = allowAssistantCall('10.0.0.8', start + 6 * 60_000);
check('day block', !overDay.ok && overDay.message.includes(day));

resetAssistantLimits();
for (let i = 0; i < 8; i += 1) check(`global allow ${i + 1}`, allowAssistantCall(`10.1.0.${i}`, start).ok);
const overGlobal = allowAssistantCall('10.1.0.99', start);
check('global block', !overGlobal.ok && overGlobal.message.includes(minute));
check('global next minute', allowAssistantCall('10.1.0.99', start + 60_000).ok);

resetAssistantLimits();
check('after reset', allowAssistantCall('10.0.0.1', start).ok);

if (failed) {
  console.error(`${failed} rate-limit check(s) failed`);
  process.exit(1);
}
console.log('rate-limit checks passed');
