import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  it('renders the toolbar with the application title', async () => {
    await TestBed.configureTestingModule({ imports: [AppComponent], providers: [provideRouter([])] }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('.app-title')?.textContent).toContain('ניהול פניות');
  });
});
