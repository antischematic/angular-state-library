import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {UITodos} from './ui-todos.component';
import {HttpClientModule} from '@angular/common/http';
import {FakeBackendModule} from './fake-backend';
import {App} from "./interfaces";
import {Action, Store} from "@mmuscat/angular-state-library";

@Store()
@Component({
   imports: [UITodos, HttpClientModule, FakeBackendModule],
   selector: 'app-root',
   standalone: true,
   templateUrl: './app.component.html',
   styleUrls: ['./app.component.css'],
   changeDetection: ChangeDetectionStrategy.OnPush,
   providers: [App.Provide(AppComponent)]
})
export class AppComponent {
   userId = '1';
   count = 0

   @Input() appStore: any

   @Action() increment() {
      this.count++
      console.log('increment', this.count)
   }

   constructor() {
      setInterval(() => {
         this.increment()
      }, 1000)
   }
}
