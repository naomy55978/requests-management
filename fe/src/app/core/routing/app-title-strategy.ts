import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

export const APP_NAME = 'ניהול פניות';

/**
 * The browser tab title: "<screen> · ניהול פניות", so the tab (and the history list) always names the application.
 * Angular's default would show the route's `title` alone ("פניות").
 */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const screen = this.buildTitle(snapshot);
    this.title.setTitle(screen ? `${screen} · ${APP_NAME}` : APP_NAME);
  }
}
