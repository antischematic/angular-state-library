import {Component, Input} from "@angular/core";
import {Action, Store} from "@antischematic/angular-state-library";
import {fireEvent, screen} from "@testing-library/angular";

@Store()
@Component({
   standalone: true,
   template: `
      count: {{ count }}
      <button (click)="increment()">Increment</button>
   `
})
export class BasicAction {
   @Input() count = 0

   @Action() increment() {
      this.count++
   }

   static start() {
      fireEvent.click(screen.getByText("Increment"))
   }
}
