import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { RequestsListStore } from '../requests-list.store';
import { RequestsTableComponent } from '../requests-table/requests-table.component';

/** The requests screen: puts the parts together and connects them to the store. */
@Component({
  selector: 'app-requests-page',
  imports: [MatCardModule, MatPaginatorModule, MatProgressBarModule, RequestsTableComponent],
  // A new store for every visit: rows and filters of a previous session never show up for the next user
  providers: [RequestsListStore],
  templateUrl: './requests-page.component.html',
  styleUrl: './requests-page.component.scss',
})
export class RequestsPageComponent {
  protected readonly store = inject(RequestsListStore);

  /** Page sizes offered to the user; 100 is the most the API accepts. */
  protected readonly pageSizeOptions = [10, 20, 50, 100];
}
