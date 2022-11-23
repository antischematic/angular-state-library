import {ChangeDetectionStrategy, Component, Input} from "@angular/core";
import {ComponentFixture} from "@angular/core/testing";
import {
   Action,
   dispatch,
   Invoke,
   Store,
   useMutation,
   useQuery
} from "@antischematic/angular-state-library";
import {fireEvent, screen} from "@testing-library/angular";
import {delay, map, of} from "rxjs";

function loadData(multiplier: number) {
   return of(10 * multiplier).pipe(
      delay(1000),
      useQuery({
         key: [multiplier]
      }),
      map((value, index) => value * (index + 1))
   )
}

function updateData(multiplier: number) {
   return of(10).pipe(
      useMutation({
         invalidate: [multiplier]
      })
   )
}

@Store()
@Component({
   standalone: true,
   template: `
      multiplier: {{ multiplier }}
      result: [{{ result }}]
      <button (click)="updateData()">Mutate</button>
   `,
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class BasicMutation {
   @Input() multiplier = 0

   result = 0

   @Invoke() loadData() {
      dispatch(loadData(this.multiplier), result => {
         this.result = result
      })
   }

   @Action() updateData() {
      dispatch(updateData(this.multiplier), result => {
         this.result = result
      })
   }

   static start(fixture: ComponentFixture<BasicMutation>) {
      fixture.autoDetectChanges(true)
   }

   static mutate() {
      fireEvent.click(screen.getByText("Mutate"))
   }
}
