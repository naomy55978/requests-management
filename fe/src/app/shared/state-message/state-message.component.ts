import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/** An empty or error message with an optional action button (e.g. "try again"). Shows what it is given. */
@Component({
  selector: 'app-state-message',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './state-message.component.html',
  styleUrl: './state-message.component.scss',
})
export class StateMessageComponent {
  readonly kind = input.required<'empty' | 'error'>();
  readonly message = input.required<string>();
  /** Text of the action button; no button when not set. */
  readonly actionLabel = input<string>();

  readonly action = output<void>();
}
