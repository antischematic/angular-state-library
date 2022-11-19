import {ChangeDetectionStrategy, Component, Directive, inject, Input} from '@angular/core';
import {UITodos} from './ui-todos.component';
import {HttpClientModule} from '@angular/common/http';
import {FakeBackendModule} from './fake-backend';
import {
   action,
   Action,
   dispatch,
   Invoke, Select,
   slice, Selector,
   store,
   Store, useMerge
} from "@antischematic/angular-state-library";
import {UICounter} from "./ui-counter.component";
import {UIDescendent} from "./ui-descendent.component";
import {UIDouble} from "./ui-double.component";
import {delay, timer} from "rxjs";
import {UITheme} from "./ui-theme";

const UserId = new Selector("UserId", () => action(RootStore, "setUserId").pipe(
   delay(0)
))

@Store()
@Directive({
   standalone: true,
   providers: [UserId]
})
class RootStore {
   @Select(UserId) userId = 1

   @Action() setUserId!: Action<(userId: number) => void>
}

@Store()
@Component({
   imports: [UITodos, UICounter, UIDescendent, UIDouble, HttpClientModule, FakeBackendModule, UITheme],
   selector: 'app-root',
   standalone: true,
   templateUrl: './app.component.html',
   styleUrls: ['./app.component.css'],
   changeDetection: ChangeDetectionStrategy.OnPush,
   hostDirectives: [RootStore],
})
export class AppComponent {
   count = 0
   blueTheme = {
      color: "blue"
   }
   greenTheme = {
      color: "green"
   }

   @Select() rootStore = inject(RootStore)

   @Select() get userId() {
      return this.rootStore.userId.toString()
   }

   @Invoke() readUserId() {
      console.log("userId changed", this.userId)
   }

   @Input() appStore: any

   declare ngOnSelect: any

   @Invoke() increment() {
      this.count++

      this.otherAction()

      dispatch(timer(1000), {
         next: this.increment
      })
   }

   @Action() otherAction() {}

   @Invoke({ track: false }) observeState() {
      const sliced = slice(AppComponent, ["count", "userId"])
      const appStore = store(AppComponent)

      useMerge()

      dispatch(sliced, (current) => {
         // console.log("slice updated", current)
      })
      dispatch(appStore, (current) => {
         // console.log("store updated", current)
      })

      setTimeout(() => {
         this.delayedAction()
      }, 500)

   }

   @Action() delayedAction() {
      const count = slice(AppComponent, "count")
      const appStore = store(AppComponent)

      useMerge()

      // dispatch(count, (current) => {
      //    // console.log("count updated 2", current)
      // })

      // dispatch(appStore, (current) => {
      //    // console.log("store updated 2", current)
      // })
   }

   swapThemes() {
      const { blueTheme, greenTheme } = this
      this.blueTheme = greenTheme
      this.greenTheme = blueTheme
   }
}
