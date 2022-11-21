import {ChangeDetectionStrategy, Component} from "@angular/core";
import {ComponentFixture} from "@angular/core/testing";
import {get, Select, Selector, Store, withState} from "@antischematic/angular-state-library";
import {interval, map, take} from "rxjs";

const Counter = new Selector("Counter", () => withState(0, {
   from: interval(1000).pipe(
      map(elapsed => elapsed + 1),
      take(10)
   )
}))

@Store()
@Component({
   standalone: true,
   template: `
      count: {{ count }}
   `,
   providers: [Counter],
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectWithState {
   @Select(Counter) count = get(Counter)

   static start(fixture: ComponentFixture<SelectWithState>) {
      fixture.autoDetectChanges(true)
   }
}
