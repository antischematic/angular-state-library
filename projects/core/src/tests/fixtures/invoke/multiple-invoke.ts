import {Component, Input} from "@angular/core";
import {ComponentFixture} from "@angular/core/testing";
import {Invoke, Store} from "@antischematic/angular-state-library";

@Store()
@Component({
   standalone: true,
   template: `
      count: {{ count }}
      first: {{ first }}
      second: {{ second }}
      third: {{ third }}
   `
})
export class MultipleInvoke {
   @Input() count = 0

   first = 0
   second = 0
   third = 0

   @Invoke() one() {
      this.first++
   }

   @Invoke() two() {
      this.first++
      this.second++
   }

   @Invoke() three() {
      this.first++
      this.second++
      this.third++
   }

   static start(fixture: ComponentFixture<MultipleInvoke>) {
      fixture.detectChanges(true)
   }
}
