import { TestBed } from '@angular/core/testing';
import { Router, TitleStrategy, provideRouter } from '@angular/router';

import { AppTitleStrategy } from './app-title-strategy';


describe('AppTitleStrategy', () => {
  async function navigate(url: string): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'requests', title: 'פניות', children: [] },
          { path: 'plain', children: [] },
        ]),
        { provide: TitleStrategy, useClass: AppTitleStrategy },
      ],
    });
    await TestBed.inject(Router).navigateByUrl(url);
  }

  it('puts the application name after the title of the screen', async () => {
    await navigate('/requests');

    expect(document.title).toBe('פניות · ניהול פניות');
  });

  it('shows only the application name for a screen without a title', async () => {
    await navigate('/plain');

    expect(document.title).toBe('ניהול פניות');
  });
});
