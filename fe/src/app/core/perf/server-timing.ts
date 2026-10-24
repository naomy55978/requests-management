/** What the API reports about one request in the `Server-Timing` header (D-25). A member the header lacks is null. */
export interface ServerTiming {
  /** Time the server spent on the whole request. */
  totalMs: number | null;
  /** Time spent in the database. */
  dbMs: number | null;
  /** Number of database commands the request ran. */
  queryCount: number | null;
  /** Only the summary reports it: was it answered from the server's cache? */
  cache: 'hit' | 'miss' | null;
}

/**
 * Reads the header the API sends, e.g. `total;dur=12.4, db;dur=8.1;desc="2 queries", cache;desc="miss"`.
 * Returns null when there is no header or nothing in it is recognised. Never throws: a header the UI
 * cannot read must not break the request that carries it.
 */
export function parseServerTiming(header: string | null | undefined): ServerTiming | null {
  if (!header) {
    return null;
  }

  const timing: ServerTiming = { totalMs: null, dbMs: null, queryCount: null, cache: null };
  let recognised = false;

  for (const metric of splitOutsideQuotes(header, ',')) {
    const [name, ...parameters] = splitOutsideQuotes(metric, ';').map((part) => part.trim());
    const duration = readNumber(parameters, 'dur');
    const description = readText(parameters, 'desc');

    switch (name.toLowerCase()) {
      case 'total':
        timing.totalMs = duration;
        recognised = recognised || duration !== null;
        break;
      case 'db':
        timing.dbMs = duration;
        timing.queryCount = description ? readFirstInteger(description) : null;
        recognised = recognised || duration !== null;
        break;
      case 'cache': {
        const outcome = description?.toLowerCase();
        timing.cache = outcome === 'hit' || outcome === 'miss' ? outcome : null;
        recognised = recognised || timing.cache !== null;
        break;
      }
    }
  }

  return recognised ? timing : null;
}

/** Splits at a separator that is not inside double quotes (a description may contain commas or semicolons). */
function splitOutsideQuotes(text: string, separator: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quoted = false;

  for (const char of text) {
    if (char === '"') {
      quoted = !quoted;
    }
    if (char === separator && !quoted) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
}

function readText(parameters: string[], key: string): string | null {
  const parameter = parameters.find((p) => p.toLowerCase().startsWith(`${key}=`));
  if (!parameter) {
    return null;
  }
  return parameter.slice(key.length + 1).replace(/^"(.*)"$/, '$1');
}

function readNumber(parameters: string[], key: string): number | null {
  const text = readText(parameters, key);
  const value = text === null || text === '' ? NaN : Number(text);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function readFirstInteger(text: string): number | null {
  const match = /\d+/.exec(text);
  return match ? Number(match[0]) : null;
}
