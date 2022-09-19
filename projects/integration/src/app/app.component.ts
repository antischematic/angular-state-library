import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {UITodos} from './ui-todos.component';
import {HttpClientModule} from '@angular/common/http';
import {FakeBackendModule} from './fake-backend';
import {createDispatch, Store, Invoke, Action} from "@antischematic/angular-state-library";
import {UICounter} from "./ui-counter.component";
import {UIDescendent} from "./ui-descendent.component";
import {UIDouble} from "./ui-double.component";
import {Observable, timer} from "rxjs";
import {UITheme} from "./ui-theme.component";

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
   interval: any
   blueTheme = {
      color: "blue"
   }
   greenTheme = {
      color: "green"
   }

   @Input() appStore: any

   @Invoke() increment(): Observable<number> {
      this.count++

      this.otherAction()

      return dispatch(timer(1000), {
         next: this.increment
      })
   }

   @Action() otherAction() {}

   swapThemes() {
      const { blueTheme, greenTheme } = this
      this.blueTheme = greenTheme
      this.greenTheme = blueTheme
   }
}

const dispatch = createDispatch(AppComponent)
