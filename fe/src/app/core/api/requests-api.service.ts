import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  BulkItem,
  BulkStatusBody,
  BulkStatusResponse,
  PagedResult,
  RequestDto,
  RequestListQuery,
  RequestStatus,
  StatusChangeBody,
  SummaryDto,
} from './api.models';

/** HTTP access to /api/requests. No state and no UI logic here. */
@Injectable({ providedIn: 'root' })
export class RequestsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/requests`;

  /**
   * One page of requests. Paging, sorting, filtering and search are all done by the server.
   * Unsubscribing cancels the HTTP request.
   */
  list(query: RequestListQuery): Observable<PagedResult<RequestDto>> {
    return this.http.get<PagedResult<RequestDto>>(this.baseUrl, { params: toHttpParams(query) });
  }

  /**
   * Moves a request to a new status. `version` is the one the user saw: if someone else changed the request since,
   * the server answers 409 (and 422 for a transition that is not allowed). 200 is the updated request, with its new version.
   */
  changeStatus(id: number, newStatus: RequestStatus, version: string): Observable<RequestDto> {
    const body: StatusChangeBody = { newStatus, version };
    return this.http.patch<RequestDto>(`${this.baseUrl}/${id}/status`, body);
  }

  /**
   * Moves several requests to the same status in one call (up to 100). Each item succeeds or fails on its own:
   * the 200 answer has the result of every item. 400 (the call itself is invalid) saves nothing.
   */
  bulkChangeStatus(newStatus: RequestStatus, items: BulkItem[]): Observable<BulkStatusResponse> {
    const body: BulkStatusBody = { newStatus, items };
    return this.http.post<BulkStatusResponse>(`${this.baseUrl}/bulk-status`, body);
  }

  /** Counts by status and priority and the top organizations in open requests (cached by the server). */
  summary(): Observable<SummaryDto> {
    return this.http.get<SummaryDto>(`${this.baseUrl}/summary`);
  }
}

/** Builds the query string. Empty filters are left out; arrays repeat the parameter (status=New&status=Waiting). */
export function toHttpParams(query: RequestListQuery): HttpParams {
  let params = new HttpParams()
    .set('page', query.page)
    .set('pageSize', query.pageSize)
    .set('sortBy', query.sortBy)
    .set('sortDir', query.sortDir);

  for (const status of query.status) {
    params = params.append('status', status);
  }
  for (const priority of query.priority) {
    params = params.append('priority', priority);
  }

  const optional: Record<string, string | null> = {
    organization: query.organization,
    assignedTo: query.assignedTo,
    createdFrom: query.createdFrom,
    createdTo: query.createdTo,
    search: query.search,
  };
  for (const [name, value] of Object.entries(optional)) {
    if (value) {
      params = params.set(name, value);
    }
  }
  return params;
}
