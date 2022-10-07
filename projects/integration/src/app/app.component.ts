import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {UITodos} from './ui-todos.component';
import {HttpClientModule} from '@angular/common/http';
import {FakeBackendModule} from './fake-backend';
import {
   Action,
   dispatch,
   Invoke,
   select,
   selectStore,
   Store, useMerge
} from "@antischematic/angular-state-library";
import {UICounter} from "./ui-counter.component";
import {UIDescendent} from "./ui-descendent.component";
import {UIDouble} from "./ui-double.component";
import {timer} from "rxjs";
import {UITheme} from "./ui-theme";

@Store()
@Component({
   imports: [UITodos, UICounter, UIDescendent, UIDouble, HttpClientModule, FakeBackendModule, UITheme],
   selector: 'app-root',
   standalone: true,
   templateUrl: './app.component.html',
   styleUrls: ['./app.component.css'],
   changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
   userId = '1';
   count = 0
   blueTheme = {
      color: "blue"
   }
   greenTheme = {
      color: "green"
   }

   @Input() appStore: any

   @Invoke() increment() {
      this.count++

      this.otherAction()

      dispatch(timer(1000), {
         next: this.increment
      })
   }

   @Action() otherAction() {}

   @Invoke({ track: false }) observeState() {
      const { count } = select(AppComponent)
      const store = selectStore(AppComponent)

      useMerge()

      dispatch(count, (current) => {
         // console.log("count updated", current)
      })
      dispatch(store, (current) => {
         // console.log("store updated", current)
      })

      setTimeout(() => {
         this.delayedAction()
      }, 500)

   }

   @Action() delayedAction() {
      const { count } = select(AppComponent)
      const store = selectStore(AppComponent)

      useMerge()

      dispatch(count, (current) => {
         // console.log("count updated 2", current)
      })

      dispatch(store, (current) => {
         // console.log("store updated 2", current)
      })
   }

   swapThemes() {
      const { blueTheme, greenTheme } = this
      this.blueTheme = greenTheme
      this.greenTheme = blueTheme
   }
}
