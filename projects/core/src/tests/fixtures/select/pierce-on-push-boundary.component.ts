import {ChangeDetectionStrategy, Component, inject} from "@angular/core";
import {ComponentFixture} from "@angular/core/testing";
import {$$, get, Select, Selector, Store, withState} from "@antischematic/angular-state-library";
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
   selector: "grandchild",
   template: `
      quadruple: {{ quadruple }}
      read: {{ read }}
   `,
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class GrandChild {
   @Select() grandparent = inject(PierceOnPushBoundary)

   read = 0

   get quadruple() {
      $$(this).read++
      return this.grandparent.double * 2
   }
}

@Store()
@Component({
   imports: [GrandChild],
   standalone: true,
   selector: "child",
   template: `
      <grandchild></grandchild>
   `,
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class Child {}

@Store()
@Component({
   imports: [Child],
   standalone: true,
   providers: [Counter],
   template: `
      count: {{ count }}
      <child></child>
   `,
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class PierceOnPushBoundary {
   @Select(Counter) count = get(Counter)

   get double() {
      return this.count * 2
   }

   static start(fixture: ComponentFixture<PierceOnPushBoundary>) {
      fixture.autoDetectChanges(true)
   }
}
