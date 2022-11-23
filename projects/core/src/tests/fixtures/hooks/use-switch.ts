import {ChangeDetectionStrategy, Component} from "@angular/core";
import {Action, dispatch, Store, useSwitch} from "@antischematic/angular-state-library";
import {fireEvent, screen} from "@testing-library/angular";
import {timer} from "rxjs";

@Store()
@Component({
   template: `
      results: [{{ results.join(' ') }}]
      <button (click)="next()">Next</button>
   `,
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class UseSwitch {
   results = [] as number[]

   count = 1

   @Action() next() {
      useSwitch()
      const count = this.count++
      dispatch(timer(1000), {
         next: () => {
            this.results.push(count)
         }
      })
   }

   static next() {
      fireEvent.click(screen.getByText("Next"))
   }
}
