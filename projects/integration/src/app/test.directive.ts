import {Store} from "@antischematic/angular-state-library";
import {Directive} from "@angular/core";

@Store()
@Directive({
   selector: "[appTest]",
   standalone: true
})
export class TestDirective {}
