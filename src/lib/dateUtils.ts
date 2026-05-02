import { format } from 'date-fns';

export const safeToDate = (date: any): Date => {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  if (date?.toDate && typeof date.toDate === 'function') return date.toDate();
  // Handle Firestore FieldValue serverTimestamp on local snapshots
  if (date && typeof date === 'object' && 'seconds' in date) {
    return new Date(date.seconds * 1000 + (date.nanoseconds || 0) / 1000000);
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) return new Date();
  return d;
};

export const isValidDate = (date: any): boolean => {
  if (!date) return false;
  const d = date?.toDate ? date.toDate() : new Date(date);
  return !isNaN(d.getTime());
};

export const safeFormat = (date: any, formatStr: string, fallback = 'N/A'): string => {
  if (!date) return fallback;
  try {
    const d = date?.toDate ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return fallback;
    return format(d, formatStr);
  } catch (e) {
    return fallback;
  }
};
