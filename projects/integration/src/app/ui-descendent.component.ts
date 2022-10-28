import {ChangeDetectionStrategy, Component, ElementRef, inject} from '@angular/core';
import {UITheme} from "./ui-theme";
import {UICounter} from "./ui-counter.component";
import {attach, Attach, Invoke, Select, Store} from "@antischematic/angular-state-library";

@Store()
@Component({
   changeDetection: ChangeDetectionStrategy.OnPush,
   selector: 'ui-descendent',
   standalone: true,
   template: `
    <p [style.color]="theme.color">UIDescendent: {{ counter.count }}</p>
  `,
})
export class UIDescendent {
   @Attach(UICounter) counter!: UICounter
   @Attach(UITheme) theme!: UITheme

   @Invoke() logTheme() {
      console.log('current theme color: ', attach(UITheme))
   }

   constructor() {
      console.log(this)
   }
}
