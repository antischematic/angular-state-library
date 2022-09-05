import {ChangeDetectionStrategy, ChangeDetectorRef, Component, inject} from '@angular/core';
import { UITodos } from './ui-todos.component';
import { HttpClientModule } from '@angular/common/http';
import { FakeBackendModule } from './fake-backend';
import {Action, Invoke, Store} from "@mmuscat/angular-state-library";

@Store()
@Component({
   imports: [UITodos, HttpClientModule, FakeBackendModule],
   selector: 'app-root',
   standalone: true,
   templateUrl: './app.component.html',
   styleUrls: ['./app.component.css'],
   changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
   userId = '1';

   count = 0

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
