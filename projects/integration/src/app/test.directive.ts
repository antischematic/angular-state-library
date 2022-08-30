import {Store} from "@mmuscat/angular-state-library";
import {Directive} from "@angular/core";

@Store()
@Directive({
   selector: "[appTest]",
   standalone: true
})
export class TestDirective {}
