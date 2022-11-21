import {ChangeDetectionStrategy, Component, Input} from "@angular/core";
import {action, Action, dispatch, Store} from "@antischematic/angular-state-library";
import {fireEvent, screen} from "@testing-library/angular";

@Store()
@Component({
   standalone: true,
   template: `
      count: {{ count }}
      <button (click)="start($event)">Start</button>
   `,
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class DispatchAfterSubscribe {
   @Input() count = 0

   @Action() start(event: MouseEvent) {
      dispatch(action(DispatchAfterSubscribe, "start"), {
         next: () => {
            this.count += event.button
         }
      })
   }

   static start(button: number) {
      fireEvent.click(screen.getByText("Start"), { button })
   }
}
