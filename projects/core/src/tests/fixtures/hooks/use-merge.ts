import {ChangeDetectionStrategy, Component} from "@angular/core";
import {Action, dispatch, Store, useMerge} from "@antischematic/angular-state-library";
import {fireEvent, screen} from "@testing-library/angular";
import {timer} from "rxjs";

@Store()
@Component({
   template: `
      results: [{{ results.join(' ') }}]
      <button (click)="next($event.button)">Next</button>
   `,
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class UseMerge {
   results = [] as number[]

   count = 1

   @Action() next(maxConcurrent: number) {
      useMerge(maxConcurrent)
      const count = this.count++
      dispatch(timer(1000), {
         next: () => {
            this.results.push(count)
         }
      })
   }

   static next(button= 999) {
      fireEvent.click(screen.getByText("Next"), { button })
   }
}
