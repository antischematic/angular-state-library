import {Directive} from "@angular/core";
import {TemplateProvider} from "@antischematic/angular-state-library";

export interface Theme {
   color: string
}

@Directive({
   standalone: true,
   selector: "ui-theme"
})
export class UITheme extends TemplateProvider {
   value: Theme = {
      color: "red"
   }
}
