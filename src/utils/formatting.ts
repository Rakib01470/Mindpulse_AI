import { format, parse, isValid, startOfWeek, startOfDay, endOfDay } from 'date-fns';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isIsoDate = (s: string | null | undefined): s is string => {
  if (!s || !ISO_DATE.test(s)) return false;
  const d = parse(s, 'yyyy-MM-dd', new Date());
  return isValid(d) && format(d, 'yyyy-MM-dd') === s;
};

export const isHHmm = (s: string | null | undefined): s is string => !!s && HH_MM.test(s);

/** Local calendar date as YYYY-MM-DD (storage format). */
export const toIsoDate = (d: Date): string => format(d, 'yyyy-MM-dd');

/** Local time as HH:mm (storage format). */
export const toHHmm = (d: Date): string => format(d, 'HH:mm');

/** 2026-10-18 → 18-10-2026 */
export const formatDisplayDate = (iso: string | null | undefined): string => {
  if (!isIsoDate(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
};

/** 15:30 → 03:30 PM; 00:05 → 12:05 AM */
export const formatTime12 = (hhmm: string | null | undefined): string => {
  if (!isHHmm(hhmm)) return '';
  const [hStr, m] = hhmm.split(':');
  const h = Number(hStr);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${m} ${suffix}`;
};

/** Combined due label, e.g. "18-10-2026 · 03:00 PM". */
export const formatDue = (date: string | null, time: string | null): string =>
  [formatDisplayDate(date), formatTime12(time)].filter(Boolean).join(' · ');

/** "Sunday, 18 October 2026" */
export const formatLongDate = (d: Date): string => format(d, 'EEEE, d MMMM yyyy');

/** Indian / South Asian digit grouping: 1234567 → 12,34,567; 1234567.891 (2dp) → 12,34,567.89 */
export const formatSouthAsianNumber = (value: number, decimals = 0): string => {
  if (!Number.isFinite(value)) return '0';
  const negative = value < 0;
  const fixed = Math.abs(value).toFixed(decimals);
  const [intPart, fracPart] = fixed.split('.');
  let grouped: string;
  if (intPart.length <= 3) {
    grouped = intPart;
  } else {
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    grouped = `${rest},${last3}`;
  }
  return `${negative ? '-' : ''}${grouped}${fracPart ? `.${fracPart}` : ''}`;
};

/** ৳12,34,567.89 */
export const formatTaka = (value: number): string => `৳${formatSouthAsianNumber(value, 2)}`;

/** 3725 → "01:02:05" (hours can exceed 99). */
export const formatStopwatch = (totalSeconds: number): string => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
};

/** Hours with at most one decimal, no trailing ".0": 14.5 → "14.5", 50 → "50". */
export const formatHours = (hours: number): string => {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

export const projectProgressRatio = (trackedSeconds: number, targetHours: number): number =>
  targetHours > 0 ? trackedSeconds / (targetHours * 3600) : 0;

/** "14.5 / 50 hrs (29%)" */
export const formatProjectProgress = (trackedSeconds: number, targetHours: number): string => {
  const pct = Math.round(projectProgressRatio(trackedSeconds, targetHours) * 100);
  return `${formatHours(trackedSeconds / 3600)} / ${formatHours(targetHours)} hrs (${pct}%)`;
};

/** Short duration for logs: 5400 → "1h 30m", 45 → "45s". */
export const formatDurationShort = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
};

/** List-view truncation (Section 10): summary.slice(0, 100) + '...' */
export const truncate = (text: string | null | undefined, max = 100): string => {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

/** ISO 8601 timestamp → "18-10-2026 03:30 PM" in local time. */
export const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  if (!isValid(d)) return '';
  return `${formatDisplayDate(toIsoDate(d))} ${formatTime12(toHHmm(d))}`;
};

/** UTC ISO bounds for "today" in local time. */
export const todayBoundsIso = (now: Date) => ({
  start: startOfDay(now).toISOString(),
  end: endOfDay(now).toISOString(),
});

/** Start of the current week (Sunday, Bangladesh business week) as UTC ISO. */
export const weekStartIso = (now: Date): string => startOfWeek(now, { weekStartsOn: 0 }).toISOString();
