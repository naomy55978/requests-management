import { BulkItemResult, BulkStatusResponse } from '../../core/api/api.models';
import { bulkRefreshesSummary, countOutcomes, toBulkResultRows } from './bulk-result';
import { fakeRequest } from './requests-list.store.test-helpers';

// One result of every outcome, in the shape the API sends them (docs/API.md)
const updated: BulkItemResult = { id: 1, outcome: 'Updated', request: { ...fakeRequest(1), status: 'InProgress' } };
const notFound: BulkItemResult = { id: 2, outcome: 'NotFound' };
const conflict: BulkItemResult = {
  id: 3,
  outcome: 'Conflict',
  currentStatus: 'Waiting',
  currentVersion: 'v9',
  currentUpdatedAt: '2026-10-23T09:29:58Z',
};
const invalid: BulkItemResult = {
  id: 4,
  outcome: 'InvalidTransition',
  currentStatus: 'New',
  currentVersion: 'v3',
  currentUpdatedAt: '2026-10-23T09:29:58Z',
  allowedStatuses: ['InProgress', 'Waiting'],
};
const invalidFinal: BulkItemResult = { ...invalid, id: 5, currentStatus: 'Completed', allowedStatuses: [] };

const titles = new Map([
  [1, 'טעות בתלוש שכר'],
  [2, 'Error in salary slip'],
  [3, 'בקשה חדשה: בונוס שנתי'],
  [4, 'ביטול כרטיס גישה'],
]);

describe('toBulkResultRows', () => {
  it('gives one line per item, in the order the server sent them, with the title of the request', () => {
    const rows = toBulkResultRows([invalid, updated, notFound], titles);

    expect(rows.map((r) => r.id)).toEqual([4, 1, 2]);
    expect(rows.map((r) => r.title)).toEqual(['ביטול כרטיס גישה', 'טעות בתלוש שכר', 'Error in salary slip']);
  });

  it('Updated: says the new status; only this outcome is a success', () => {
    const [row] = toBulkResultRows([updated], titles);

    expect(row).toMatchObject({ outcome: 'Updated', success: true });
    expect(row.text).toBe('עודכנה ל«בטיפול»');
  });

  it('NotFound: says the request was not found', () => {
    const [row] = toBulkResultRows([notFound], titles);

    expect(row).toMatchObject({ outcome: 'NotFound', success: false });
    expect(row.text).toContain('לא נמצאה');
  });

  it('Conflict: says someone else changed it, what it is now, and that nothing was changed', () => {
    const [row] = toBulkResultRows([conflict], titles);

    expect(row).toMatchObject({ outcome: 'Conflict', success: false });
    expect(row.text).toContain('עודכנה בינתיים על ידי משתמש אחר');
    expect(row.text).toContain('כעת «ממתינה»');
    expect(row.text).toContain('לא בוצע שינוי');
  });

  it('InvalidTransition: says the change is not allowed and where the request can go', () => {
    const [row] = toBulkResultRows([invalid], titles);

    expect(row).toMatchObject({ outcome: 'InvalidTransition', success: false });
    expect(row.text).toContain('מעבר אסור');
    expect(row.text).toContain('מותר: בטיפול, ממתינה');
  });

  it('InvalidTransition from a completed request: says the status is final', () => {
    const [row] = toBulkResultRows([invalidFinal], titles);

    expect(row.text).toContain('הסטטוס סופי');
  });

  it('survives an answer without the optional members', () => {
    const rows = toBulkResultRows(
      [
        { id: 1, outcome: 'Updated' },
        { id: 2, outcome: 'Conflict' },
        { id: 3, outcome: 'InvalidTransition', currentStatus: 'Mystery' as never },
      ],
      new Map(),
    );

    expect(rows.map((r) => r.title)).toEqual(['', '', '']);
    expect(rows.every((r) => r.text.length > 0)).toBe(true);
  });
});

describe('countOutcomes', () => {
  it('counts every outcome, shows only those that happened, and puts "updated" first', () => {
    const counts = countOutcomes([notFound, updated, conflict, invalid, { ...updated, id: 6 }, invalidFinal]);

    expect(counts.map((c) => [c.outcome, c.count])).toEqual([
      ['Updated', 2],
      ['Conflict', 1],
      ['InvalidTransition', 2],
      ['NotFound', 1],
    ]);
    expect(counts[0].label).toBe('עודכנו');
  });

  it('is empty for no results', () => {
    expect(countOutcomes([])).toEqual([]);
  });
});

describe('bulkRefreshesSummary', () => {
  const response = (...results: BulkItemResult[]): BulkStatusResponse => ({
    total: results.length,
    succeeded: results.filter((r) => r.outcome === 'Updated').length,
    failed: results.filter((r) => r.outcome !== 'Updated').length,
    results,
  });

  it('is true when something was updated', () => {
    expect(bulkRefreshesSummary(response(updated, notFound))).toBe(true);
  });

  it('is true when only conflicts came back (the data is different from what the user saw)', () => {
    expect(bulkRefreshesSummary(response(conflict, invalid))).toBe(true);
  });

  it('is false when nothing changed on the server', () => {
    expect(bulkRefreshesSummary(response(invalid, notFound))).toBe(false);
  });
});
