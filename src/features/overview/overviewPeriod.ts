import type { OverviewDateRange, OverviewPeriodKey } from '@/features/overview/types';

export const OVERVIEW_PERIOD_OPTIONS: Array<{ key: OverviewPeriodKey; label: string }> = [
  { key: 'day', label: 'Hôm nay' },
  { key: 'week', label: 'Tuần này' },
  { key: 'month', label: 'Tháng này' },
  { key: 'quarter', label: 'Quý này' },
  { key: 'year', label: 'Năm nay' },
];

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function getTodayKey(now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const y = get('year');
    const m = get('month');
    const d = get('day');
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback to device local date if Intl timezone is unavailable.
  }
  return formatDateKey(now);
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

function shiftDays(date: Date, delta: number): Date {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + delta);
  return copy;
}

export function formatDisplayDate(dateKey: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey;
  const [y, m, d] = dateKey.split('-');
  return `${d}/${m}/${y}`;
}

export function formatShortDate(dateKey: string): string {
  if (!dateKey) return '';
  if (dateKey.length === 7) return `${dateKey.slice(5)}/${dateKey.slice(2, 4)}`;
  if (dateKey.length >= 10) return `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
  return dateKey;
}

export function getOverviewDateRange(key: OverviewPeriodKey, now = new Date()): OverviewDateRange {
  const today = getTodayKey(now);
  const endDate = parseKey(today);
  const startDate = new Date(endDate.getTime());

  if (key === 'week') {
    const mondayOffset = (startDate.getDay() + 6) % 7;
    startDate.setDate(startDate.getDate() - mondayOffset);
  } else if (key === 'month') {
    startDate.setDate(1);
  } else if (key === 'quarter') {
    const quarterStartMonth = Math.floor(startDate.getMonth() / 3) * 3;
    startDate.setMonth(quarterStartMonth, 1);
  } else if (key === 'year') {
    startDate.setMonth(0, 1);
  }

  const from = formatDateKey(startDate);
  const to = today;

  let previousFrom: string;
  let previousTo: string;
  let comparisonLabel: string;

  if (key === 'day') {
    const prev = shiftDays(startDate, -1);
    previousFrom = formatDateKey(prev);
    previousTo = previousFrom;
    comparisonLabel = 'So với hôm qua';
  } else if (key === 'week') {
    const prevEnd = shiftDays(startDate, -1);
    const prevStart = shiftDays(prevEnd, -6);
    previousFrom = formatDateKey(prevStart);
    previousTo = formatDateKey(prevEnd);
    comparisonLabel = 'So với tuần trước';
  } else if (key === 'month') {
    const prevEnd = shiftDays(startDate, -1);
    const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1, 12, 0, 0);
    previousFrom = formatDateKey(prevStart);
    previousTo = formatDateKey(prevEnd);
    comparisonLabel = `So với T${prevStart.getMonth() + 1}/${prevStart.getFullYear()}`;
  } else if (key === 'quarter') {
    const prevEnd = shiftDays(startDate, -1);
    const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth() - 2, 1, 12, 0, 0);
    previousFrom = formatDateKey(prevStart);
    previousTo = formatDateKey(prevEnd);
    const prevQuarter = Math.floor(prevStart.getMonth() / 3) + 1;
    comparisonLabel = `So với Q${prevQuarter}/${prevStart.getFullYear()}`;
  } else {
    const prevYear = startDate.getFullYear() - 1;
    previousFrom = `${prevYear}-01-01`;
    previousTo = `${prevYear}-12-31`;
    comparisonLabel = `So với năm ${prevYear}`;
  }

  const option = OVERVIEW_PERIOD_OPTIONS.find((item) => item.key === key) ?? OVERVIEW_PERIOD_OPTIONS[2];

  return {
    key,
    label: option.label,
    from,
    to,
    previousFrom,
    previousTo,
    comparisonLabel,
  };
}

export function formatInt(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return Math.round(value).toLocaleString('vi-VN');
}

export function formatCompactMoney(value: number | null | undefined, suffix = '₫'): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e9) {
    return `${(value / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỉ`;
  }
  if (abs >= 1e6) {
    return `${(value / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  }
  if (abs >= 1e3) {
    return `${(value / 1e3).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} K`;
  }
  return `${Math.round(value).toLocaleString('vi-VN')}${suffix ? ` ${suffix}` : ''}`;
}

export function computePercentDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous)) {
    return null;
  }
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

export function formatDeltaBadge(delta: number | null | undefined): string | undefined {
  if (delta == null || !Number.isFinite(delta)) return undefined;
  if (delta > 0) return `+ ${delta}%`;
  if (delta < 0) return `− ${Math.abs(delta)}%`;
  return '0%';
}

