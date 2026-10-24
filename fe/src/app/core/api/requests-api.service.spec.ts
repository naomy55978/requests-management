import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RequestListQuery, UNASSIGNED } from './api.models';
import { RequestsApiService } from './requests-api.service';

const BASE_QUERY: RequestListQuery = {
  page: 1,
  pageSize: 20,
  status: [],
  priority: [],
  organization: '',
  assignedTo: '',
  createdFrom: null,
  createdTo: null,
  search: '',
  sortBy: 'createdAt',
  sortDir: 'desc',
};

describe('RequestsApiService', () => {
  let service: RequestsApiService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(RequestsApiService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  function sentParams(query: RequestListQuery) {
    service.list(query).subscribe();
    const request = backend.expectOne((r) => r.url === '/api/requests');
    expect(request.request.method).toBe('GET');
    return request.request.params;
  }

  it('sends paging and sorting always, and nothing else for an empty query', () => {
    const params = sentParams({ ...BASE_QUERY, page: 3, pageSize: 50, sortBy: 'title', sortDir: 'asc' });

    expect(params.keys().sort()).toEqual(['page', 'pageSize', 'sortBy', 'sortDir']);
    expect(params.get('page')).toBe('3');
    expect(params.get('pageSize')).toBe('50');
    expect(params.get('sortBy')).toBe('title');
    expect(params.get('sortDir')).toBe('asc');
  });

  it('repeats the parameter for multi-value filters (status=New&status=Waiting)', () => {
    const params = sentParams({ ...BASE_QUERY, status: ['New', 'Waiting'], priority: ['High'] });

    expect(params.getAll('status')).toEqual(['New', 'Waiting']);
    expect(params.getAll('priority')).toEqual(['High']);
  });

  it('sends every text, date and handler filter that has a value', () => {
    const params = sentParams({
      ...BASE_QUERY,
      organization: 'Acme',
      assignedTo: UNASSIGNED,
      createdFrom: '2026-01-05',
      createdTo: '2026-01-31',
      search: 'לוגו',
    });

    expect(params.get('organization')).toBe('Acme');
    expect(params.get('assignedTo')).toBe('unassigned');
    expect(params.get('createdFrom')).toBe('2026-01-05');
    expect(params.get('createdTo')).toBe('2026-01-31');
    expect(params.get('search')).toBe('לוגו');
  });

  it('cancels the HTTP request when the caller unsubscribes', () => {
    const subscription = service.list(BASE_QUERY).subscribe();
    const request = backend.expectOne((r) => r.url === '/api/requests');

    subscription.unsubscribe();

    expect(request.cancelled).toBe(true);
  });

  it('reads the summary from /api/requests/summary', () => {
    let total = 0;
    service.summary().subscribe((summary) => (total = summary.total));

    const request = backend.expectOne('/api/requests/summary');
    expect(request.request.method).toBe('GET');
    request.flush({ total: 7, byStatus: [], byPriority: [], topOrganizations: [] });

    expect(total).toBe(7);
  });
});
