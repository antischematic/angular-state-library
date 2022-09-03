import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UITodos } from './ui-todos.component';
import { HttpClientModule } from '@angular/common/http';
import { FakeBackendModule } from './fake-backend';

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
}
