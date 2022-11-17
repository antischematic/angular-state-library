import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {Select, Store} from '@antischematic/angular-state-library';
import {UICounter} from "./ui-counter.component";

@Store()
@Component({
   changeDetection: ChangeDetectionStrategy.OnPush,
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
   @Select() counter = inject(UICounter); // reactive proxy

   @Select() get doubled() {
      return this.counter.count * 2; // reactive state derived from parent store
   }
}
