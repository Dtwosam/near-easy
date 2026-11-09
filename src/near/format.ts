const YOCTO = 10n ** 24n;
const STORAGE_BYTE = 10n ** 19n;

export function parseYocto(value: string): bigint | null {
  if (!/^\d+$/.test(value)) return null;
  return BigInt(value);
}

/** Liquid balance minus the NEAR locked for storage. Never negative. */
export function spendableYocto(amount: bigint, storageBytes: bigint): bigint {
  if (amount < 0n) return 0n;
  const reserve = storageBytes > 0n ? storageBytes * STORAGE_BYTE : 0n;
  if (amount <= reserve) return 0n;
  return amount - reserve;
}

/** Truncate toward zero. A positive remainder below the last digit is shown as less-than. */
export function formatNear(yocto: bigint, places = 4): string {
  if (yocto <= 0n) return '0';
  const whole = yocto / YOCTO;
  const fraction = yocto % YOCTO;
  if (fraction === 0n) return whole.toString();
  const scale = 10n ** BigInt(24 - places);
  const digits = (fraction / scale).toString().padStart(places, '0').replace(/0+$/, '');
  if (!digits) {
    if (whole === 0n) return `<0.${'0'.repeat(places - 1)}1`;
    return whole.toString();
  }
  return `${whole}.${digits}`;
}

export function nearToYocto(value: string): bigint | null {
  const trimmed = value.trim();
  if (!/^\d{1,12}(\.\d{1,6})?$/.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  const padded = `${fraction}${'0'.repeat(24)}`.slice(0, 24);
  return BigInt(whole) * YOCTO + BigInt(padded);
}

export function amountExceeds(amount: string, availableYocto: string): boolean {
  const requested = nearToYocto(amount);
  const available = parseYocto(availableYocto);
  if (requested == null || available == null) return false;
  return requested > available;
}

export function shortAccount(accountId: string): string {
  if (accountId.length <= 18) return accountId;
  return `${accountId.slice(0, 6)}…${accountId.slice(-4)}`;
}
