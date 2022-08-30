import {ChangeDetectionStrategy, Component} from '@angular/core';
import {UITodos} from "./ui-todos.component";
import {HttpClientModule} from "@angular/common/http";
import {TestDirective} from "./test.directive";

@Component({
   imports: [UITodos, TestDirective, HttpClientModule],
   selector: 'app-root',
   standalone: true,
   templateUrl: './app.component.html',
   styleUrls: ['./app.component.css'],
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
   userId = "1"
}
