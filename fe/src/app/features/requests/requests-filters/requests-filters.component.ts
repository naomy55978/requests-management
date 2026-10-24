import { Component, computed, inject, output } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { asapScheduler, debounceTime, startWith } from 'rxjs';

import {
  REQUEST_PRIORITIES,
  REQUEST_STATUSES,
  RequestPriority,
  RequestStatus,
} from '../../../core/api/api.models';
import { PRIORITY_LABELS, STATUS_LABELS } from '../../../core/i18n/labels';
import { toDateOnly } from '../date-only';
import {
  ASSIGNED_TO_MAX_LENGTH,
  ORGANIZATION_MAX_LENGTH,
  RequestFilters,
  SEARCH_MAX_LENGTH,
  SEARCH_MIN_LENGTH,
  hasEnteredFilters,
} from '../request-filters';

/**
 * The filter and search form. It only collects what the user typed or picked and reports it (filtersChange);
 * the pause after typing, the check of the date range and the requests themselves are the store's job.
 */
@Component({
  selector: 'app-requests-filters',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './requests-filters.component.html',
  styleUrl: './requests-filters.component.scss',
})
export class RequestsFiltersComponent {
  /** Emits the complete form value after every change. */
  readonly filtersChange = output<RequestFilters>();

  protected readonly searchMaxLength = SEARCH_MAX_LENGTH;
  protected readonly searchMinLength = SEARCH_MIN_LENGTH;
  protected readonly organizationMaxLength = ORGANIZATION_MAX_LENGTH;
  protected readonly assignedToMaxLength = ASSIGNED_TO_MAX_LENGTH;

  protected readonly statusOptions = REQUEST_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }));
  protected readonly priorityOptions = REQUEST_PRIORITIES.map((value) => ({ value, label: PRIORITY_LABELS[value] }));

  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly form = this.fb.group({
    search: '',
    organization: '',
    assignedTo: '',
    unassigned: false,
    status: this.fb.control<RequestStatus[]>([]),
    priority: this.fb.control<RequestPriority[]>([]),
    range: this.fb.group({
      start: this.fb.control<Date | null>(null),
      end: this.fb.control<Date | null>(null),
    }),
  });

  // The form is not a signal; this one ticks on every change so the values below are recomputed
  private readonly changes = toSignal(this.form.valueChanges.pipe(startWith(null)));

  /** One typed character is not enough to search: the user gets a hint instead of silence. */
  protected readonly searchTooShort = computed(() => {
    this.changes();
    return this.form.controls.search.value.trim().length === SEARCH_MIN_LENGTH - 1;
  });

  protected readonly canClear = computed(() => {
    this.changes();
    return hasEnteredFilters(this.toFilters());
  });

  protected readonly hasDates = computed(() => {
    this.changes();
    const { start, end } = this.form.controls.range.getRawValue();
    return start !== null || end !== null;
  });

  constructor() {
    // While "without a handler" is checked the handler text has no meaning, so the field is disabled
    this.form.controls.unassigned.valueChanges.pipe(takeUntilDestroyed()).subscribe((unassigned) => {
      const field = this.form.controls.assignedTo;
      if (unassigned) {
        field.disable({ emitEvent: false });
      } else {
        field.enable({ emitEvent: false });
      }
    });

    // One report per user action. A single action can make the form emit several times in a row (e.g. "clear"
    // resets the controls one by one, and Material's date-range inputs revalidate each other in between), and
    // those half-cleared values must not reach the server. The values are read after the burst, not from it.
    this.form.valueChanges
      .pipe(debounceTime(0, asapScheduler), takeUntilDestroyed())
      .subscribe(() => this.filtersChange.emit(this.toFilters()));
  }

  /** Empties every field (also called by the page's "clear filters" button on an empty result). */
  clear(): void {
    this.form.reset();
  }

  protected clearDates(): void {
    this.form.controls.range.reset();
  }

  private toFilters(): RequestFilters {
    // getRawValue: a disabled control (the handler text) is still part of the form
    const value = this.form.getRawValue();
    return {
      search: value.search,
      organization: value.organization,
      assignedTo: value.assignedTo,
      unassigned: value.unassigned,
      status: value.status,
      priority: value.priority,
      createdFrom: toDateOnly(value.range.start),
      createdTo: toDateOnly(value.range.end),
    };
  }
}
