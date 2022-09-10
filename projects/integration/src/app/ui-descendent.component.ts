import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Counter } from './providers';
import {Theme} from "./ui-theme.component";

@Component({
   changeDetection: ChangeDetectionStrategy.OnPush,
   providers: [Counter, Theme],
   selector: 'ui-descendent',
   standalone: true,
   template: `
    <p [style.color]="theme.color">UIDescendent: {{ counter.count }}</p>
  `,
})
export class UIDescendent {
   counter = inject(Counter);
   theme = inject(Theme)
}
