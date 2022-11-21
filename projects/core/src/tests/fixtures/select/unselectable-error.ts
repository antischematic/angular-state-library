import {ChangeDetectionStrategy, Component, InjectionToken} from "@angular/core";
import {ComponentFixture} from "@angular/core/testing";
import {Caught, Select, Store} from "@antischematic/angular-state-library";

class Counter {}

@Store()
@Component({
   standalone: true,
   template: `
      count: {{ count }}
   `,
   providers: [Counter],
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class UnselectableError {
   @Select(Counter) count = 0

   static start(fixture: ComponentFixture<UnselectableError>) {
      fixture.autoDetectChanges(true)
   }
}
