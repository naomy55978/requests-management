import { HebrewPaginatorIntl } from './hebrew-paginator-intl';

describe('HebrewPaginatorIntl', () => {
  const intl = new HebrewPaginatorIntl();

  it('has Hebrew labels', () => {
    expect(intl.itemsPerPageLabel).toBe('פריטים בעמוד:');
    expect(intl.nextPageLabel).toBe('לעמוד הבא');
  });

  it('describes the visible range with thousands separators', () => {
    expect(intl.getRangeLabel(0, 20, 100_000)).toBe('1–20 מתוך 100,000');
    expect(intl.getRangeLabel(4999, 20, 100_000)).toBe('99,981–100,000 מתוך 100,000');
  });

  it('cuts the last range at the total', () => {
    expect(intl.getRangeLabel(2, 20, 45)).toBe('41–45 מתוך 45');
  });

  it('handles an empty list', () => {
    expect(intl.getRangeLabel(0, 20, 0)).toBe('0 מתוך 0');
  });
});
