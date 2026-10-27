import { Injectable } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';

/** Hebrew texts of the paginator (Material ships English only). */
@Injectable()
export class HebrewPaginatorIntl extends MatPaginatorIntl {
  override itemsPerPageLabel = 'פריטים בעמוד:';
  override nextPageLabel = 'לעמוד הבא';
  override previousPageLabel = 'לעמוד הקודם';
  override firstPageLabel = 'לעמוד הראשון';
  override lastPageLabel = 'לעמוד האחרון';

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0) {
      return '0 מתוך 0';
    }
    const start = page * pageSize + 1;
    const end = Math.min((page + 1) * pageSize, length);
    return `${start.toLocaleString('he-IL')}–${end.toLocaleString('he-IL')} מתוך ${length.toLocaleString('he-IL')}`;
  };
}
