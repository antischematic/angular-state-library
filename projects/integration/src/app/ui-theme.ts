import {TemplateProvider} from "@antischematic/angular-state-library";
import {Directive} from "@angular/core";

@Directive({
   standalone: true,
   selector: "ui-theme"
})
export class UITheme extends TemplateProvider {
   color = "red"
}
