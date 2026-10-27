import { UNASSIGNED } from '../../core/api/api.models';
import { DEFAULT_QUERY } from './requests-list.store';
import {
  EMPTY_FILTERS,
  RequestFilters,
  hasActiveFilters,
  hasEnteredFilters,
  isEmptyFilters,
  normalizeTextFilters,
  pickTextFilters,
  withOptionFilters,
  withTextFilters,
} from './request-filters';

const filters = (patch: Partial<RequestFilters>): RequestFilters => ({ ...EMPTY_FILTERS, ...patch });

describe('normalizeTextFilters', () => {
  it('trims all texts', () => {
    expect(normalizeTextFilters({ search: '  logo  ', organization: ' Acme ', assignedTo: ' dana ' })).toEqual({
      search: 'logo',
      organization: 'Acme',
      assignedTo: 'dana',
    });
  });

  it('treats a search shorter than 2 characters as no search', () => {
    expect(normalizeTextFilters({ search: 'a', organization: '', assignedTo: '' }).search).toBe('');
    expect(normalizeTextFilters({ search: ' a ', organization: '', assignedTo: '' }).search).toBe('');
    expect(normalizeTextFilters({ search: 'ab', organization: '', assignedTo: '' }).search).toBe('ab');
  });

  it('cuts texts to the limits of the API, so the server never has to answer 400 for length', () => {
    const result = normalizeTextFilters({ search: 'x'.repeat(150), organization: 'y'.repeat(200), assignedTo: 'z'.repeat(150) });

    expect(result.search).toHaveLength(100);
    expect(result.organization).toHaveLength(150);
    expect(result.assignedTo).toHaveLength(100);
  });

  it('keeps the "unassigned" marker as it is', () => {
    expect(normalizeTextFilters({ search: '', organization: '', assignedTo: UNASSIGNED }).assignedTo).toBe(UNASSIGNED);
  });
});

describe('pickTextFilters', () => {
  it('sends "unassigned" instead of the handler text while the checkbox is set', () => {
    expect(pickTextFilters(filters({ assignedTo: 'dana', unassigned: true })).assignedTo).toBe(UNASSIGNED);
    expect(pickTextFilters(filters({ assignedTo: 'dana', unassigned: false })).assignedTo).toBe('dana');
  });
});

describe('withTextFilters / withOptionFilters', () => {
  it('returns the same query when nothing changed, so no request is sent', () => {
    expect(withTextFilters(DEFAULT_QUERY, { search: '', organization: '', assignedTo: '' })).toBe(DEFAULT_QUERY);
    expect(withOptionFilters(DEFAULT_QUERY, { status: [], priority: [], createdFrom: null, createdTo: null })).toBe(
      DEFAULT_QUERY,
    );
  });

  it('starts again from page 1 when a filter changed', () => {
    const onPage5 = { ...DEFAULT_QUERY, page: 5 };

    expect(withTextFilters(onPage5, { search: 'logo', organization: '', assignedTo: '' })).toMatchObject({
      search: 'logo',
      page: 1,
    });
    expect(
      withOptionFilters(onPage5, { status: ['New'], priority: [], createdFrom: null, createdTo: null }),
    ).toMatchObject({ status: ['New'], page: 1 });
  });

  it('keeps sorting and page size when filters change', () => {
    const query = { ...DEFAULT_QUERY, sortBy: 'title' as const, sortDir: 'asc' as const, pageSize: 50 };

    expect(withTextFilters(query, { search: 'logo', organization: '', assignedTo: '' })).toMatchObject({
      sortBy: 'title',
      sortDir: 'asc',
      pageSize: 50,
    });
  });
});

describe('filter state helpers', () => {
  it('knows when the query is narrowed by a filter (sort and paging do not count)', () => {
    expect(hasActiveFilters(DEFAULT_QUERY)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_QUERY, page: 3, sortBy: 'title' })).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_QUERY, priority: ['High'] })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_QUERY, search: 'logo' })).toBe(true);
  });

  it('counts a one-character search as empty for the store, but as entered for the clear button', () => {
    const oneCharacter = filters({ search: 'a' });

    expect(isEmptyFilters(oneCharacter)).toBe(true);
    expect(hasEnteredFilters(oneCharacter)).toBe(true);
    expect(isEmptyFilters(EMPTY_FILTERS)).toBe(true);
    expect(hasEnteredFilters(EMPTY_FILTERS)).toBe(false);
    expect(isEmptyFilters(filters({ unassigned: true }))).toBe(false);
  });
});
