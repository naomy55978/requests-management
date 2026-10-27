import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from './core/auth/auth.service';
import { SHOW_PERFORMANCE } from './core/perf/show-performance';
import { PerformancePanelComponent } from './shared/performance-panel/performance-panel.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatButtonModule, PerformancePanelComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  protected readonly auth = inject(AuthService);

  /** The performance button and panel exist only when the optional performance UI is on. */
  protected readonly showPerformance = inject(SHOW_PERFORMANCE);

  /** The performance panel is closed until the user opens it (D-23): it must not take over the app. */
  protected readonly performanceOpen = signal(false);

  private readonly performanceButton = viewChild('performanceButton', { read: ElementRef<HTMLElement> });

  protected togglePerformance(): void {
    this.performanceOpen.update((open) => !open);
    // Opening: the panel moves focus to itself. Closing: the panel is gone, and focus would be lost with it.
    if (!this.performanceOpen()) {
      this.performanceButton()?.nativeElement.focus();
    }
  }
}
