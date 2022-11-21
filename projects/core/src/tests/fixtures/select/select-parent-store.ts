import {ChangeDetectionStrategy, Component} from "@angular/core";
import {ComponentFixture} from "@angular/core/testing";
import {Select, Selector, slice, Store} from "@antischematic/angular-state-library";
import {interval, map, take} from "rxjs";

const Increment = new Selector("Increment", () => interval(1000).pipe(
   map(elapsed => elapsed + 1),
   take(10)
))
const Count = new Selector("Count", () => slice(Parent, "count"))

@Store()
@Component({
   standalone: true,
   selector: "child",
   template: `
      child: {{ count }}
   `,
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class Child {
   @Select(Count) count = 0
}

@Store()
@Component({
   imports: [Child],
   standalone: true,
   template: `
      parent: {{ count }}
      <child></child>
   `,
   providers: [Increment, Count],
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class Parent {
   @Select(Increment) count = 0

   static start(fixture: ComponentFixture<Parent>) {
      fixture.autoDetectChanges(true)
   }
}
