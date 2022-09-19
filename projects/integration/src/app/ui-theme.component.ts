import {Provider} from "@antischematic/angular-state-library";
import {Directive, ElementRef, inject} from "@angular/core";

@Directive({
   standalone: true,
   selector: "Theme",
})
export class UITheme extends Provider {
   color = "red"
}

