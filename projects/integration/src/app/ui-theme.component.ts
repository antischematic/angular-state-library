import {Store, ValueToken} from "@antischematic/angular-state-library";
import {Directive, Input} from "@angular/core";

export const Theme = new ValueToken<UITheme>("Theme")

@Store()
@Directive({
   standalone: true,
   selector: "[theme]",
   providers: [Theme.Provide(UITheme)]
})
export class UITheme {
   @Input() theme = {
      color: "red"
   }
}
