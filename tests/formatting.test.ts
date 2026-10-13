import {
  formatDisplayDate,
  formatLongDate,
  formatSouthAsianNumber,
  formatTaka,
  formatTime12,
  formatDue,
  isIsoDate,
  truncate,
  weekStartIso,
} from '../src/utils/formatting';

describe('Section 9 — formatting.ts', () => {
  it('ISO date → dd-mm-yyyy', () => {
    expect(formatDisplayDate('2026-10-18')).toBe('18-10-2026');
    expect(formatDisplayDate('2026-02-30')).toBe('');
    expect(formatDisplayDate(null)).toBe('');
  });

  it('24h → 12h AM/PM', () => {
    expect(formatTime12('15:30')).toBe('03:30 PM');
    expect(formatTime12('03:30')).toBe('03:30 AM');
    expect(formatTime12('00:05')).toBe('12:05 AM');
    expect(formatTime12('12:00')).toBe('12:00 PM');
    expect(formatTime12('24:00')).toBe('');
    expect(formatDue('2026-10-18', '15:00')).toBe('18-10-2026 · 03:00 PM');
  });

  it('South Asian lakh grouping', () => {
    expect(formatSouthAsianNumber(1234567)).toBe('12,34,567');
    expect(formatSouthAsianNumber(999)).toBe('999');
    expect(formatSouthAsianNumber(1000)).toBe('1,000');
    expect(formatSouthAsianNumber(100000)).toBe('1,00,000');
    expect(formatSouthAsianNumber(123456789)).toBe('12,34,56,789');
    expect(formatSouthAsianNumber(-1234567.891, 2)).toBe('-12,34,567.89');
    expect(formatTaka(1234567.89)).toBe('৳12,34,567.89');
  });

  it('header date and Sunday week start', () => {
    expect(formatLongDate(new Date(2026, 9, 18))).toBe('Sunday, 18 October 2026');
    // Tue 13 Oct 2026 → week starts Sun 11 Oct (local midnight)
    expect(new Date(weekStartIso(new Date(2026, 9, 13, 15))).getDate()).toBe(11);
    expect(new Date(weekStartIso(new Date(2026, 9, 11, 0, 30))).getDate()).toBe(11);
  });

  it('list truncation (Section 10)', () => {
    const long = 'a'.repeat(1200);
    expect(truncate(long)).toBe(`${'a'.repeat(100)}...`);
    expect(truncate('short')).toBe('short');
  });

  it('ISO date validator', () => {
    expect(isIsoDate('2026-10-13')).toBe(true);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('13-10-2026')).toBe(false);
  });
});
