import {ChangeDetectionStrategy, Component, Input} from "@angular/core";
import {ComponentFixture} from "@angular/core/testing";
import {dispatch, Invoke, Store, useQuery} from "@antischematic/angular-state-library";
import {delay, of} from "rxjs";

function loadData(multiplier: number) {
   return of(10 * multiplier).pipe(
      delay(1000),
      useQuery({
         key: [multiplier]
      })
   )
}

@Store()
@Component({
   standalone: true,
   template: `
      multiplier: {{ multiplier }}
      result: [{{ result }}]
   `,
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class BasicQuery {
   @Input() multiplier = 0

   result = 0

   @Invoke() loadData() {
      dispatch(loadData(this.multiplier), result => {
         this.result = result
      })
   }

   static start(fixture: ComponentFixture<BasicQuery>) {
      fixture.autoDetectChanges(true)
   }
}
