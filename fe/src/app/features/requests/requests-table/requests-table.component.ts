import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';

import { RequestDto, RequestSortField, SortDirection } from '../../../core/api/api.models';
import { PriorityChipComponent } from '../../../shared/priority-chip/priority-chip.component';
import { StatusChipComponent } from '../../../shared/status-chip/status-chip.component';

export interface SortChange {
  sortBy: RequestSortField;
  sortDir: SortDirection;
}

/** The rows of one page. Presents what it is given and reports sort clicks; it sorts and loads nothing. */
@Component({
  selector: 'app-requests-table',
  imports: [DatePipe, MatTableModule, MatSortModule, StatusChipComponent, PriorityChipComponent],
  templateUrl: './requests-table.component.html',
  styleUrl: './requests-table.component.scss',
})
export class RequestsTableComponent {
  readonly items = input.required<RequestDto[]>();
  readonly sortBy = input.required<RequestSortField>();
  readonly sortDir = input.required<SortDirection>();
  /** Dims the rows while a new page is loading (they stay readable). */
  readonly busy = input(false);

  readonly sortChange = output<SortChange>();

  protected readonly columns = [
    'id',
    'title',
    'organizationName',
    'status',
    'priority',
    'assignedTo',
    'createdAt',
    'updatedAt',
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
