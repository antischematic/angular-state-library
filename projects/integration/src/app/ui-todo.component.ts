import { CommonModule } from '@angular/common';
import {
   ChangeDetectionStrategy,
   Component,
   EventEmitter,
   Input,
   Output,
} from '@angular/core';
import { Todo } from './interfaces';

@Component({
   imports: [CommonModule],
   selector: 'ui-todo',
   standalone: true,
   changeDetection: ChangeDetectionStrategy.OnPush,
   templateUrl: './ui-todo.component.html',
})
export class UITodo {
   @Input() value: Todo = UITodo.defaultValue;
   @Output() save = new EventEmitter<Todo>();

   toggleComplete(completed: boolean) {
      this.save.emit({
         ...this.value,
         completed,
      });
   }

   updateText(title: string) {
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
