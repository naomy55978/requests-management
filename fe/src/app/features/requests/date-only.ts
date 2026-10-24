/**
 * The day the user picked, as `yyyy-MM-dd` from the picked day's own year, month and day (what the API expects).
 * `toISOString()` is not used on purpose: it converts to UTC and would shift a day picked at local midnight
 * back to the previous day in time zones ahead of UTC (Israel).
 */
export function toDateOnly(date: Date | null): string | null {
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** A range is valid when one end is missing or "from" is not after "to". The API rejects the other case with 400. */
export function isDateRangeValid(from: string | null, to: string | null): boolean {
  // yyyy-MM-dd strings sort in date order
  return !from || !to || from <= to;
}
