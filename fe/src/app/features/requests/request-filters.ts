import { RequestListQuery, RequestPriority, RequestStatus, UNASSIGNED } from '../../core/api/api.models';

/** Search starts at this many characters (the API answers 400 below it); one character matches too much to be useful. */
export const SEARCH_MIN_LENGTH = 2;

// The same limits as the API (RequestFilter), so a request that would be answered with 400 is never sent
export const SEARCH_MAX_LENGTH = 100;
export const ORGANIZATION_MAX_LENGTH = 150;
export const ASSIGNED_TO_MAX_LENGTH = 100;

/** What the filter form holds. Dates are `yyyy-MM-dd` (see toDateOnly). */
export interface RequestFilters {
  search: string;
  organization: string;
  /** Text typed in the handler field. */
  assignedTo: string;
  /** "Without a handler" checkbox; when set, the text above is ignored. */
  unassigned: boolean;
  status: RequestStatus[];
  priority: RequestPriority[];
  createdFrom: string | null;
  createdTo: string | null;
}

export const EMPTY_FILTERS: RequestFilters = {
  search: '',
  organization: '',
  assignedTo: '',
  unassigned: false,
  status: [],
  priority: [],
  createdFrom: null,
  createdTo: null,
};

/** The filters typed as free text. They are applied after a pause in typing (see RequestsListStore). */
export interface TextFilters {
  search: string;
  organization: string;
  /** What the query sends: a user name, or {@link UNASSIGNED}. */
  assignedTo: string;
}

/** The filters picked from a list or calendar. They are applied at once. */
export interface OptionFilters {
  status: RequestStatus[];
  priority: RequestPriority[];
  createdFrom: string | null;
  createdTo: string | null;
}

export const EMPTY_TEXT_FILTERS: TextFilters = { search: '', organization: '', assignedTo: '' };

export const EMPTY_OPTION_FILTERS: OptionFilters = { status: [], priority: [], createdFrom: null, createdTo: null };

/** The typed part of the filters, which the store sends only after a pause in typing. */
export function pickTextFilters(filters: RequestFilters): TextFilters {
  // The checkbox travels with the text fields so "who is the assignee" is decided in one place
  return {
    search: filters.search,
    organization: filters.organization,
    assignedTo: filters.unassigned ? UNASSIGNED : filters.assignedTo,
  };
}

/** The picked part of the filters (statuses, priorities, dates), which the store sends at once. */
export function pickOptionFilters(filters: RequestFilters): OptionFilters {
  return {
    status: filters.status,
    priority: filters.priority,
    createdFrom: filters.createdFrom,
    createdTo: filters.createdTo,
  };
}

/** Trims, cuts to the API's limits, and treats a search shorter than the minimum as "no search". */
export function normalizeTextFilters(text: TextFilters): TextFilters {
  const search = text.search.trim().slice(0, SEARCH_MAX_LENGTH);
  return {
    search: search.length >= SEARCH_MIN_LENGTH ? search : '',
    organization: text.organization.trim().slice(0, ORGANIZATION_MAX_LENGTH),
    assignedTo: text.assignedTo === UNASSIGNED ? UNASSIGNED : text.assignedTo.trim().slice(0, ASSIGNED_TO_MAX_LENGTH),
  };
}

/** True when both hold the same text filters, so an unchanged value does not cause another request. */
export function sameTextFilters(a: TextFilters, b: TextFilters): boolean {
  return a.search === b.search && a.organization === b.organization && a.assignedTo === b.assignedTo;
}

/** True when both hold the same option filters, so an unchanged value does not cause another request. */
export function sameOptionFilters(a: OptionFilters, b: OptionFilters): boolean {
  return (
    sameList(a.status, b.status) &&
    sameList(a.priority, b.priority) &&
    a.createdFrom === b.createdFrom &&
    a.createdTo === b.createdTo
  );
}

/** Applies new text filters to a query. Returns the same object when nothing changed; a change starts at page 1. */
export function withTextFilters(query: RequestListQuery, text: TextFilters): RequestListQuery {
  return sameTextFilters(query, text) ? query : { ...query, ...text, page: 1 };
}

/** Applies new option filters to a query. Returns the same object when nothing changed; a change starts at page 1. */
export function withOptionFilters(query: RequestListQuery, options: OptionFilters): RequestListQuery {
  return sameOptionFilters(query, options)
    ? query
    : { ...query, ...options, status: [...options.status], priority: [...options.priority], page: 1 };
}

/** True when the user has typed or picked anything at all, even a search that is still too short to be sent. */
export function hasEnteredFilters(filters: RequestFilters): boolean {
  return (
    filters.search !== '' ||
    filters.organization !== '' ||
    filters.assignedTo !== '' ||
    filters.unassigned ||
    filters.status.length > 0 ||
    filters.priority.length > 0 ||
    filters.createdFrom !== null ||
    filters.createdTo !== null
  );
}

/** True when the form holds no filter at all (what "clear filters" produces). A one-character search counts as none. */
export function isEmptyFilters(filters: RequestFilters): boolean {
  return (
    sameTextFilters(normalizeTextFilters(pickTextFilters(filters)), EMPTY_TEXT_FILTERS) &&
    sameOptionFilters(pickOptionFilters(filters), EMPTY_OPTION_FILTERS)
  );
}

/** True when the query is narrowed by any filter or search (sorting and paging do not count). */
export function hasActiveFilters(query: RequestListQuery): boolean {
  return (
    query.status.length > 0 ||
    query.priority.length > 0 ||
    query.organization !== '' ||
    query.assignedTo !== '' ||
    query.createdFrom !== null ||
    query.createdTo !== null ||
    query.search !== ''
  );
}

/** True when both lists hold the same values in the same order. */
function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
