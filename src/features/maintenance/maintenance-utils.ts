const IST_OFFSET_MINUTES = 330;
const MINUTE_MS = 60_000;

export const MAINTENANCE_TIMEZONE = 'Asia/Kolkata';

export const formatMaintenanceDateTime = (value: string | Date) =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: MAINTENANCE_TIMEZONE,
  }).format(value instanceof Date ? value : new Date(value));

export const istDateTimeLocalValue = (value: string | Date): string => {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getTime() + IST_OFFSET_MINUTES * MINUTE_MS)
    .toISOString()
    .slice(0, 16);
};

export const isoFromIstDateTimeLocal = (value: string): string => {
  const clean = value.trim();
  if (!clean) return '';
  return new Date(`${clean}:00+05:30`).toISOString();
};

export const formatDuration = (totalSeconds: number): string => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }
  return `${minutes}m ${remainingSeconds}s`;
};
