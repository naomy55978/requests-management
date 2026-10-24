import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterOutlet } from '@angular/router';

import { AuthService } from './core/auth/auth.service';
import { PerformancePanelComponent } from './shared/performance-panel/performance-panel.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MatToolbarModule, MatButtonModule, PerformancePanelComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  protected readonly auth = inject(AuthService);

  /** The performance panel is closed until the user opens it (D-23): it must not take over the app. */
  protected readonly performanceOpen = signal(false);

  protected togglePerformance(): void {
    this.performanceOpen.update((open) => !open);
  }
}
