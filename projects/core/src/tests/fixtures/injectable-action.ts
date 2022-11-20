import {Component, inject, InjectionToken, Input} from "@angular/core";
import {Action, dispatch, Store} from "@antischematic/angular-state-library";
import {fireEvent, screen} from "@testing-library/angular";
import {of, throwError} from "rxjs";

const INCREMENT = new InjectionToken<number>("INCREMENT")

@Store()
@Component({
   standalone: true,
   template: `
      count: {{ count }}
      <button (click)="increment()">Increment</button>
   `
})
export class InjectableAction {
   @Input() count = 0

   @Action() increment() {
      this.count += inject(INCREMENT)
   }

   static start() {
      fireEvent.click(screen.getByText("Increment"))
   }

   static INCREMENT = INCREMENT
}

@Store()
@Component({
   standalone: true,
   template: `
      count: {{ count }}
      <button (click)="increment()">Increment</button>
   `
})
export class InjectableActionWithEffect {
   @Input() count = 0

   @Action() increment() {
      dispatch(of(null), {
         next: () => {
            this.count += inject(INCREMENT)
         },
         complete: () => {
            this.count += inject(INCREMENT)
         },
         finalize: () => {
            this.count += inject(INCREMENT)
         }
      })
   }

   static start() {
      fireEvent.click(screen.getByText("Increment"))
   }

   static INCREMENT = INCREMENT
}

@Store()
@Component({
   standalone: true,
   template: `
      count: {{ count }}
      <button (click)="increment()">Increment</button>
   `
})
export class InjectableActionWithEffectError {
   @Input() count = 0

   @Action() increment() {
      dispatch(throwError(() => new Error("BOGUS")), {
         error: () => {
            this.count += inject(INCREMENT)
         }
      })
   }

   static start() {
      fireEvent.click(screen.getByText("Increment"))
   }

   static INCREMENT = INCREMENT
}
