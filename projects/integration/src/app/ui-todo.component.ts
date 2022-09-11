import { CommonModule } from '@angular/common';
import {
   ChangeDetectionStrategy,
   Component,
   EventEmitter,
   inject,
   Input,
   Output,
} from '@angular/core';
import {Action, Invoke, Queue, Store} from '@antischematic/angular-state-library';
import {Todo} from './interfaces';
import { UISpinner } from './spinner.component';
import {AppStore} from "./providers";

@Store()
@Component({
   imports: [CommonModule, UISpinner],
   selector: 'ui-todo',
   standalone: true,
   changeDetection: ChangeDetectionStrategy.OnPush,
   templateUrl: './ui-todo.component.html',
   providers: [AppStore]
})
export class UITodo {
   @Input() value: Todo = UITodo.defaultValue;
   @Output() save = new EventEmitter<Todo>();

   @Queue() pending = false;

   root = inject(AppStore)

   trackCount() {
      console.log("reactive parent", this.root.count)
   }

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
