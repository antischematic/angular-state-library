import {AsyncPipe} from "@angular/common";
import {Component, HostListener, inject, Input, Output} from "@angular/core";
import {
   Action,
   dispatch,
   Select,
   Store,
   Transition, TransitionToken,
   useTransition
} from "@antischematic/angular-state-library";
import {fireEvent, screen} from "@testing-library/angular";
import {delay, of} from "rxjs";

const Loading = new TransitionToken("Loading")

function loadData(multiplier: number) {
   return of(10 * multiplier).pipe(
      delay(1000),
      useTransition(inject(Loading)),
   )
}

@Component({
   selector: 'button[transition]',
   imports: [AsyncPipe],
   standalone: true,
   template: `
      press: {{ press.isUnstable | async }}
      <ng-content></ng-content>
   `
})
class Button {
   @Output() press = new Transition<void>()

   @HostListener("click") handleClick() {
      this.press.emit()
   }
}

@Store()
@Component({
   imports: [Button],
   standalone: true,
   template: `
      loading: {{ transition.unstable }}
      <button [transition] (press)="loadData()">Load</button>
   `
})
export class UseTransition {
   @Input() multiplier = 0

   @Select() transition = inject(Loading)

   @Action() loadData() {
      dispatch(loadData(this.multiplier))
   }

   static start() {
      fireEvent.click(screen.getByText("Load", { selector: 'button', exact: false }))
   }
}
