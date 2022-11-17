import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {get, Invoke, Store, Select} from "@antischematic/angular-state-library";
import {UICounter} from "./ui-counter.component";
import {UITheme} from "./ui-theme";

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
   @Select() counter = inject(UICounter)
   @Select(UITheme) theme = get(UITheme)

   @Invoke() logTheme() {
      console.log('current theme color: ', this.theme)
   }
}
