import { Component, inject, viewChild } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { StateMessageComponent } from '../../../shared/state-message/state-message.component';
import { RequestsFiltersComponent } from '../requests-filters/requests-filters.component';
import { RequestsListStore } from '../requests-list.store';
import { RequestsTableComponent } from '../requests-table/requests-table.component';
import { SummaryCardsComponent } from '../summary-cards/summary-cards.component';
import { SummaryStore } from '../summary.store';

/** The requests screen: puts the parts together and connects them to the store. */
@Component({
  selector: 'app-requests-page',
  imports: [
    MatCardModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    RequestsFiltersComponent,
    RequestsTableComponent,
    StateMessageComponent,
    SummaryCardsComponent,
  ],
  // A new store for every visit: rows and filters of a previous session never show up for the next user
  providers: [RequestsListStore, SummaryStore],
  templateUrl: './requests-page.component.html',
  styleUrl: './requests-page.component.scss',
})
export class RequestsPageComponent {
  protected readonly store = inject(RequestsListStore);
  protected readonly summaryStore = inject(SummaryStore);

  private readonly filters = viewChild.required(RequestsFiltersComponent);

  /** Page sizes offered to the user; 100 is the most the API accepts. */
  protected readonly pageSizeOptions = [10, 20, 50, 100];

  /** "Clear filters" on an empty result: the form is the one that knows how to reset itself (and tells the store). */
  protected clearFilters(): void {
    this.filters().clear();
  }
}
