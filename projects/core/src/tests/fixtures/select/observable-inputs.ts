import {ChangeDetectionStrategy, Component, Input} from "@angular/core";
import {ComponentFixture} from "@angular/core/testing";
import {
   $$,
   inputs,
   Invoke,
   Select,
   Selector,
   Store,
   TypedChange
} from "@antischematic/angular-state-library";
import {filter, map} from "rxjs";

// input changes are delivered asynchronously
const CountChange = new Selector("CountChange", () => inputs(ObservableInputs).pipe(
   map(changes => changes.count),
   filter(Boolean),
))

@Store()
@Component({
   standalone: true,
   template: `
      count: {{ count }},
      previous: {{ countChange.previousValue ?? "empty" }}
      current: {{ countChange?.currentValue }}
      firstChange: {{ countChange?.firstChange }}
      read: {{ read }}
   `,
   providers: [CountChange],
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class ObservableInputs {
   @Input() count = 0

   @Select(CountChange) countChange?: TypedChange<number>

   read = 0

   @Invoke() countChanges() {
      void this.count
      void this.countChange

      $$(this).read++
   }

   static start(fixture: ComponentFixture<ObservableInputs>) {
      fixture.autoDetectChanges(true)
   }
}
