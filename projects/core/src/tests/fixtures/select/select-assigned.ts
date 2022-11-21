import {ChangeDetectionStrategy, Component, Input} from "@angular/core";
import {ComponentFixture} from "@angular/core/testing";
import {Action, Select, Store, Transition} from "@antischematic/angular-state-library";
import {fireEvent, screen} from "@testing-library/angular";
import {noop} from "../../../utils";

@Store()
@Component({
   standalone: true,
   template: `
      count: {{ count }}
      transition: {{ transition.unstable }}
      <button (click)="startTransition()">Start</button>
   `,
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectAssigned {
   @Input() count = 0

   @Select() transition = new Transition()

   startTransition() {
      this.transition.run(() => {
         setTimeout(noop, 2000)
      })
   }

   static start() {
      fireEvent.click(screen.getByText("Start"))
   }
}
