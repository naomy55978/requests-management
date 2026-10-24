/** A duration for display: one decimal below 10 ms ("3.4 ms"), whole milliseconds above ("42 ms"). */
export function formatMs(ms: number): string {
  return ms < 10 ? `${ms.toFixed(1)} ms` : `${Math.round(ms)} ms`;
}
