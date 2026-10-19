export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-19" w czasie lokalnym */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function hhmm(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseHHMM(s: string): [number, number] {
  const [h, m] = s.split(':').map((x) => parseInt(x, 10));
  return [isNaN(h) ? 0 : h, isNaN(m) ? 0 : m];
}

/** Data dla dnia `day` o godzinie "HH:MM" */
export function atTime(day: Date, time: string): Date {
  const [h, m] = parseHHMM(time);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Stabilny 31-bitowy hash – id powiadomień w Androidzie muszą być int32 */
export function hashInt(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 1) || 1;
}

export function cmpVersion(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
