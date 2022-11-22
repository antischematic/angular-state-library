import {ChangeDetectionStrategy, Component, Input} from "@angular/core";
import {
   Action,
   get,
   Select,
   Selector,
   slice,
   Store,
   withState
} from "@antischematic/angular-state-library";
import {fireEvent, screen} from "@testing-library/angular";
import {map} from "rxjs";

const Slice = new Selector("Counter", () => withState(0, {
   from: slice(SliceState, "count").pipe(
      map(count => count * 2)
   )
}))

const SliceMany = new Selector("Counter", () => slice(SliceState, ["count", "double"]))

@Store()
@Component({
   standalone: true,
   template: `
      count: {{ count }}
      double: {{ double }}
      many: {{ many?.count }} {{ many?.double }}
      <button (click)="increment()">Increment</button>
   `,
   providers: [Slice, SliceMany],
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class SliceState {
   @Input() count = 0

   @Select(Slice) double = get(Slice)

   @Select(SliceMany) many?: { count: number, double: number }

   @Action() increment() {
      this.count++
   }

   static increment() {
      fireEvent.click(screen.getByText("Increment"))
   }
}
