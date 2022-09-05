import { CommonModule } from '@angular/common';
import {
   ChangeDetectionStrategy,
   Component,
   EventEmitter, forwardRef, inject,
   Input,
   Output,
} from '@angular/core';
import {$, Action, configureStore, Queue, Select, Store} from '@mmuscat/angular-state-library';
import { Todo } from './interfaces';
import { UISpinner } from './spinner.component';
import {AppComponent} from "./app.component";

@Store()
@Component({
   imports: [CommonModule, UISpinner],
   selector: 'ui-todo',
   standalone: true,
   changeDetection: ChangeDetectionStrategy.OnPush,
   templateUrl: './ui-todo.component.html',
   providers: [
      configureStore({ deps: [forwardRef(() => AppComponent)] })
   ]
})
export class UITodo {
   @Input() value: Todo = UITodo.defaultValue;
   @Output() save = new EventEmitter<Todo>();

   @Queue() pending = false;

   root = inject(AppComponent)

   @Action() toggleComplete(completed: boolean) {
      this.save.emit({
         ...this.value,
         completed,
      });
   }

   @Action() updateText(title: string) {
      this.save.emit({
         ...this.value,
         title,
      });
   }

   static defaultValue = {
      id: undefined,
      title: '',
      completed: false,
   };
}
