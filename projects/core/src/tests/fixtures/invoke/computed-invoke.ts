import {ChangeDetectionStrategy, Component, Input} from "@angular/core";
import {ComponentFixture} from "@angular/core/testing";
import {Action, Invoke, Select, Store} from "@antischematic/angular-state-library";
import {fireEvent, screen} from "@testing-library/angular";

@Store()
@Component({
   standalone: true,
   template: `
      count1: {{ count1 }}
      count2: {{ count2 }}
      count3: {{ count3 }}
      sum: {{ sum }}
      computed: {{ computed }}
      read: {{ times }}
      <button (click)="increment()">Increment</button>
   `,
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComputedInvoke {
   @Input() count1 = 1
   @Input() count2 = 10
   @Input() count3 = 100

   @Select() get sum() {
      this.computed++
      return this.count1 + this.count2 + this.count3
   }

   computed = 0
   times = 0

   @Action() increment() {
      this.count1++
      this.count2++
      this.count3++
   }

   @Invoke() read() {
      void this.count1
      void this.count2
      void this.count3
      this.times++
   }

   static start(fixture: ComponentFixture<ComputedInvoke>) {
      fixture.autoDetectChanges()
   }

   static increment() {
      fireEvent.click(screen.getByText("Increment"))
   }
}
