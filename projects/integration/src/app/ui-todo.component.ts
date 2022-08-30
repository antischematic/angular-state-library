import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from "@angular/core";
import {Todo} from "./interfaces";
import {TestDirective} from "./test.directive";

@Component({
   imports: [TestDirective],
   selector: 'ui-todo',
   standalone: true,
   changeDetection: ChangeDetectionStrategy.OnPush,
   template: `
      <input type="checkbox" [disabled]="!value.id" [checked]="value.completed"
         (change)="toggleComplete(checkbox.checked)" #checkbox />
      <input type="text" [disabled]="value.completed" [value]="value.title"
         (keydown.enter)="updateText(text.value); text.value = ''" #text />
   `,
   styles: [`
      :host {
         display: block
      }
   `]
})
export class UITodo {
   @Input() value: Todo = UITodo.defaultValue
   @Output() save = new EventEmitter<Todo>()

   toggleComplete(completed: boolean) {
      this.handleChange({
         ...this.value,
         completed
      })
   }

   updateText(title: string) {
      this.handleChange({
         ...this.value,
         title
      })
   }

   handleChange(change: Todo) {
      this.save.emit(change)
   }

   static defaultValue = {
      id: undefined,
      title: "",
      completed: false
   }
}
