import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Counter } from './providers';

@Component({
   changeDetection: ChangeDetectionStrategy.OnPush,
   providers: [Counter],
   selector: 'ui-descendent',
   standalone: true,
   template: `
    <p>UIDescendent: {{ counter.count }}</p>
  `,
})
export class UIDescendent {
   counter = inject(Counter);
}
