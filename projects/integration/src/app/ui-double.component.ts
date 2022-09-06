import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Select, Store } from '@mmuscat/angular-state-library';
import { Counter } from './providers';

@Store()
@Component({
   changeDetection: ChangeDetectionStrategy.OnPush,
   providers: [Counter],
   selector: 'ui-double',
   standalone: true,
   template: `
    <p>UIDouble: {{ doubled }}</p>
    <dd>
      <ng-content></ng-content>
    </dd>
  `,
})
export class UIDouble {
   counter = inject(Counter); // reactive proxy

   @Select() get doubled() {
      return this.counter.count * 2; // reactive state derived from parent store
   }
}
