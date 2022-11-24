import {ChangeDetectionStrategy, Component, Input} from "@angular/core";
import {ComponentFixture} from "@angular/core/testing";
import {$$, Invoke, Store} from "@antischematic/angular-state-library";

@Store()
@Component({
   standalone: true,
   template: `
      count: {{ count }}
      first: {{ first }}
      second: {{ second }}
      third: {{ third }}
   `,
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class MultipleInvoke {
   @Input() count = 0

   first = 0
   second = 0
   third = 0

   @Invoke() one() {
      $$(this).first++
      void this.count
   }

   @Invoke() two() {
      $$(this).first++
      $$(this).second++
      void this.count
   }

   @Invoke() three() {
      $$(this).first++
      $$(this).second++
      $$(this).third++
      void this.count
   }

   static start(fixture: ComponentFixture<MultipleInvoke>) {
      fixture.autoDetectChanges(true)
   }
}
