import {ChangeDetectionStrategy, Component, ElementRef, inject} from '@angular/core';
import {UITheme} from "./ui-theme";
import {UICounter} from "./ui-counter.component";
import {attach} from "@antischematic/angular-state-library";

@Component({
   changeDetection: ChangeDetectionStrategy.OnPush,
   selector: 'ui-descendent',
   standalone: true,
   template: `
    <p [style.color]="theme.color">UIDescendent: {{ counter.count }}</p>
  `,
})
export class UIDescendent {
   counter = attach(UICounter);
   theme = attach(UITheme)
}
