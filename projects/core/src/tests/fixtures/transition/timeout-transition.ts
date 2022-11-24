import {AsyncPipe} from "@angular/common";
import {Component, HostListener, Input, Output} from "@angular/core";
import {Action, dispatch, Store, Transition} from "@antischematic/angular-state-library";
import {fireEvent, screen} from "@testing-library/angular";
import {delay, of} from "rxjs";

function loadData(multiplier: number) {
   return of(10 * multiplier).pipe(
      delay(1000)
   )
}

@Component({
   selector: 'button[transition]',
   imports: [AsyncPipe],
   standalone: true,
   template: `
      press: {{ press.isUnstable | async }}
      timeout: {{ press.timeout }}
      error: {{ press.thrownError?.message }}
      <ng-content></ng-content>
   `
})
class Button {
   @Output() press = new Transition<void>({
      timeoutMs: 500
   })

   @HostListener("click") handleClick() {
      this.press.emit()
   }
}

@Store()
@Component({
   imports: [Button],
   standalone: true,
   template: `
      <button [transition] (press)="loadData()">Load</button>
   `
})
export class TimeoutTransition {
   @Input() multiplier = 0

   @Action() loadData() {
      dispatch(loadData(this.multiplier))
   }

   static start() {
      fireEvent.click(screen.getByText("Load", { selector: 'button', exact: false }))
   }
}
