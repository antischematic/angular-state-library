import { ChangeDetectionStrategy, Component } from '@angular/core';
import {select, Select, Store} from '@antischematic/angular-state-library';
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
   counter = select(UICounter); // reactive proxy

   @Select() get doubled() {
      return this.counter.count * 2; // reactive state derived from parent store
   }
}