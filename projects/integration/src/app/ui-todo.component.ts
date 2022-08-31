import { CommonModule } from '@angular/common';
import {
   ChangeDetectionStrategy,
   Component,
   EventEmitter,
   Input,
   Output,
} from '@angular/core';
import { Todo } from './interfaces';
import {UISpinner} from "./spinner.component";
import {Action, createDispatch, Queue, Store} from "@mmuscat/angular-state-library";
import {timer} from "rxjs";

@Store()
@Component({
   imports: [CommonModule, UISpinner],
   selector: 'ui-todo',
   standalone: true,
   changeDetection: ChangeDetectionStrategy.OnPush,
   templateUrl: './ui-todo.component.html',
})
export class UITodo {
   @Input() value: Todo = UITodo.defaultValue;
   @Output() save = new EventEmitter<Todo>();

   @Queue() pending = false

   @Action() toggleComplete(completed: boolean) {
      this.save.emit({
         ...this.value,
         completed,
      });
      return dispatch(timer(2000))
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

const dispatch = createDispatch(UITodo)
