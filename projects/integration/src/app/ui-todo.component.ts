import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, forwardRef, Input, Output,} from '@angular/core';
import {Action, Attach, Store, Transition} from '@antischematic/angular-state-library';
import {AppComponent} from "./app.component";
import {Todo} from './interfaces';
import {UISpinner} from './spinner.component';

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
   @Output() save = new Transition<Todo>({});

   @Attach(forwardRef(() => AppComponent)) root!: AppComponent

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
