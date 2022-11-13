import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, Input, Output,} from '@angular/core';
import {FormsModule} from "@angular/forms";
import {
   Action,
   Attach,
   dispatch,
   Select,
   Store,
   Transition,
   $$
} from '@antischematic/angular-state-library';
import {noop} from "rxjs";
import {Todo} from './interfaces';
import {UISpinner} from './spinner.component';

@Store()
@Component({
   imports: [CommonModule, UISpinner, FormsModule],
   selector: 'ui-todo',
   standalone: true,
   changeDetection: ChangeDetectionStrategy.OnPush,
   templateUrl: './ui-todo.component.html',
})
export class UITodo {
   @Input() value: Todo = { ...UITodo.defaultValue };

   @Attach() @Output() save = new Transition<Todo>({
      resetOnSuccess: true,
   });

   @Select() get model() {
      return { ...this.value }
   }

   @Action() saveTodo() {
      dispatch(this.save.emit(this.model), {
         error: noop,
         finalize: () => {
            this.value = { ...this.value }
         }
      })
   }

   static defaultValue = {
      id: undefined,
      title: '',
      completed: false,
   };
}
