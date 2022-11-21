import {ChangeDetectionStrategy, Component} from "@angular/core";
import {ComponentFixture} from "@angular/core/testing";
import {Select, Selector, Store} from "@antischematic/angular-state-library";
import {interval, map, take} from "rxjs";

const Counter = new Selector("Counter", () => interval(1000).pipe(
   map(elapsed => elapsed + 1),
   take(10)
))

@Store()
@Component({
   standalone: true,
   template: `
      count: {{ count }}
   `,
   providers: [Counter],
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class BasicAsyncSelector {
   @Select(Counter) count = 0

   static start(fixture: ComponentFixture<BasicAsyncSelector>) {
      fixture.autoDetectChanges(true)
   }
}
