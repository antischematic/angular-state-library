import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {Attach, Invoke, Store} from "@antischematic/angular-state-library";
import {getValue} from "../../../core/src/template-provider";
import {UICounter} from "./ui-counter.component";
import {Theme, UITheme} from "./ui-theme";

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
   @Attach() counter = inject(UICounter)
   @Attach(UITheme) theme = getValue(UITheme)

   @Invoke() logTheme() {
      console.log('current theme color: ', this.theme)
   }
}
