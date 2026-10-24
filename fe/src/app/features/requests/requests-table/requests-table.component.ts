import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';

import { RequestDto, RequestSortField, RequestStatus, SortDirection } from '../../../core/api/api.models';
import { allowedNext } from '../../../core/api/status-transitions';
import { STATUS_LABELS } from '../../../core/i18n/labels';
import { PriorityChipComponent } from '../../../shared/priority-chip/priority-chip.component';
import { StatusChipComponent } from '../../../shared/status-chip/status-chip.component';

/** The user picked a new status for a row, from its action menu. */
export interface StatusChangeRequest {
  row: RequestDto;
  status: RequestStatus;
}

export interface SortChange {
  sortBy: RequestSortField;
  sortDir: SortDirection;
}

/**
 * The rows of one page. Presents what it is given and reports sort clicks and the status the user picked;
 * it sorts, loads and sends nothing.
 */
@Component({
  selector: 'app-requests-table',
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatSortModule,
    StatusChipComponent,
    PriorityChipComponent,
  ],
  templateUrl: './requests-table.component.html',
  styleUrl: './requests-table.component.scss',
})
export class RequestsTableComponent {
  readonly items = input.required<RequestDto[]>();
  readonly sortBy = input.required<RequestSortField>();
  readonly sortDir = input.required<SortDirection>();
  /** Dims the rows while a new page is loading (they stay readable). */
  readonly busy = input(false);
  /** Rows whose status change is on its way: their action is disabled, so a change cannot be sent twice. */
  readonly pendingIds = input<ReadonlySet<number>>(new Set());

  readonly sortChange = output<SortChange>();
  readonly statusChange = output<StatusChangeRequest>();

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly allowedNext = allowedNext;

  protected readonly columns = [
    'id',
    'title',
    'organizationName',
    'status',
    'priority',
    'assignedTo',
    'createdAt',
    'updatedAt',
    'actions',
  ];

  protected onSort(sort: Sort): void {
    // Clearing the sort is disabled (matSortDisableClear), so there is always a direction.
    // Column names are the API's sort field names.
    if (sort.direction) {
      this.sortChange.emit({ sortBy: sort.active as RequestSortField, sortDir: sort.direction });
    }
  }

  protected trackById(_index: number, row: RequestDto): number {
    return row.id;
  }
}
