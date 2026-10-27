/**
 * The picked day as `yyyy-MM-dd` (what the API expects), from its own year, month and day: `toISOString()` would
 * convert to UTC and move a day picked at local midnight back by one in Israel.
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
