import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {UITodos} from './ui-todos.component';
import {HttpClientModule} from '@angular/common/http';
import {FakeBackendModule} from './fake-backend';
import {Action, createDispatch, Invoke, Store} from "@mmuscat/angular-state-library";
import {Observable, timer} from "rxjs";
import {AppStore} from "./providers";
import {UICounter} from "./ui-counter.component";
import {UIDescendent} from "./ui-descendent.component";
import {UIDouble} from "./ui-double.component";

@Store()
@Component({
   imports: [UITodos, UICounter, UIDescendent, UIDouble, HttpClientModule, FakeBackendModule],
   selector: 'app-root',
   standalone: true,
   templateUrl: './app.component.html',
   styleUrls: ['./app.component.css'],
   changeDetection: ChangeDetectionStrategy.OnPush,
   providers: [AppStore.Provide(AppComponent)]
})
export class AppComponent {
   userId = '1';
   count = 0
   interval: any

   @Input() appStore: any

   @Invoke() increment(): Observable<number> {
      this.count++

      this.otherAction()

      return dispatch(timer(1000), {
         next: this.increment
      })
   }

   @Action() otherAction() {}
}

const dispatch = createDispatch(AppComponent)
