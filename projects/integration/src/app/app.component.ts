import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UITodos } from './ui-todos.component';
import { HttpClientModule } from '@angular/common/http';
import { FakeBackendModule } from './fake-backend';
import { ActionType, DISPATCHER } from '@mmuscat/angular-state-library';

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
   // log all actions
   subscription = inject(DISPATCHER).subscribe((event) => {
      const name = Object.getPrototypeOf(event.context).constructor.name;
      console.log(
         `${name}:${event.name as string}:${event.type}`,
         event
      );
   });

   ngOnDestroy() {
      this.subscription.unsubscribe();
   }
}
