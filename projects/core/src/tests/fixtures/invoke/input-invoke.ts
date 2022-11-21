import {ChangeDetectionStrategy, Component, Input} from "@angular/core";
import {ComponentFixture} from "@angular/core/testing";
import {Invoke, Store} from "@antischematic/angular-state-library";

@Store()
@Component({
   standalone: true,
   template: `
      count: {{ count }}
      read: {{ times }}
   `,
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class InputInvoke {
   @Input() count = 1

   times = 0

   @Invoke() read() {
      void this.count
      this.times++
   }

   static start(fixture: ComponentFixture<InputInvoke>) {
      fixture.autoDetectChanges(true)
   }
}
