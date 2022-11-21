import {ChangeDetectionStrategy, Component, Input} from "@angular/core";
import {Action, dispatch, Store} from "@antischematic/angular-state-library";
import {fireEvent, screen} from "@testing-library/angular";
import {from, merge, throwError} from "rxjs";

@Store()
@Component({
   standalone: true,
   template: `
      count: {{ count }}
      <button (click)="start()">Start</button>
   `
})
export class DispatchActionsInCallOrder {
   @Input() count = 0

   @Action() start() {
      this.count++
      this.next()
   }

   @Action() next() {
      this.count++
      if (this.count <= 3) {
         this.next()
      } else {
         this.finally()
      }
   }

   @Action() finally() {
      this.count++
   }

   static start() {
      fireEvent.click(screen.getByText("Start"))
   }
}

@Store()
@Component({
   standalone: true,
   template: `
      count: {{ count }}
      complete: {{ complete }}
      <button (click)="start()">Start</button>
   `
})
export class DispatchActionsInCallOrderWithEffect {
   @Input() count = 0

   complete = false

   @Action() setCount(value: number) {
      this.count = value
   }

   @Action() setComplete() {
      this.complete = true
   }

   @Action() start() {
      dispatch(from([1, 2, 3]), {
         next: this.setCount,
         complete: this.setComplete,
         finalize: this.finally
      })
   }
   @Action() finally!: () => void

   static start() {
      fireEvent.click(screen.getByText("Start"))
   }
}

@Store()
@Component({
   standalone: true,
   template: `
      count: {{ count }}
      error: {{ error?.message }}
      <button (click)="start()">Start</button>
   `,
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class DispatchActionsInCallOrderWithEffectError {
   @Input() count = 0

   error: any

   @Action() setCount(value: number) {
      this.count = value
   }

   @Action() setError(error: unknown) {
      this.error = error
   }

   @Action() start() {
      dispatch(merge(from([1, 2, 3]), throwError(() => new Error("BOGUS"))), {
         next: this.setCount,
         error: this.setError,
         finalize: this.finally
      })
   }

   @Action() finally!: () => void

   static start() {
      fireEvent.click(screen.getByText("Start"))
   }
}
