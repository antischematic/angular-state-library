import {
   Action,
   createDispatch,
   createEffect,
   Invoke,
   Select,
   Store
} from "@mmuscat/angular-state-library";
import {UITodo} from "./ui-todo.component";
import {exhaustAll, mergeAll, Observable} from "rxjs";
import {HttpClient} from "@angular/common/http";
import {ChangeDetectionStrategy, Component, inject, Input} from "@angular/core";
import {Todo} from "./interfaces";
import {CommonModule} from "@angular/common";
import {TestDirective} from "./test.directive";

@Store()
@Component({
   imports: [UITodo, TestDirective, CommonModule],
   selector: 'ui-todos',
   standalone: true,
   changeDetection: ChangeDetectionStrategy.OnPush,
   template: `
      <h2>Add todo</h2>
      <ui-todo (save)="createTodo($event)"></ui-todo>

      <h2>{{remaining.length}} todos remaining</h2>
      <ui-todo *ngFor="let todo of remaining" [value]="todo" (save)="updateTodo($event)"></ui-todo>

      <h2>{{completed.length}} of {{todos.length}} todos completed</h2>
      <ui-todo *ngFor="let todo of completed" [value]="todo" (save)="updateTodo($event)"></ui-todo>
   `,
   styles: [`
      :host {
         display: block
      }
   `]
})
export class UITodos {
   @Input() userId!: string

   todos: Todo[] = []

   @Select() get remaining() {
      return this.todos.filter(todo => !todo.completed)
   }

   @Select() get completed() {
      return this.todos.filter(todo => todo.completed)
   }

   @Invoke() loadTodos() {
      return dispatch(loadTodos(this.userId), {
         next(todos) {
            this.todos = todos
         }
      })
   }

   @Action() createTodo(todo: Todo) {
      return dispatch(createTodo(todo.title), {
         next: this.loadTodos
      })
   }

   @Action() updateTodo(todo: Todo) {
      return dispatch(updateTodo(todo), {
         next: this.loadTodos
      })
   }
}

const dispatch = createDispatch(UITodos)

function loadTodos(userId: string): Observable<Todo[]> {
   return inject(HttpClient).get<Todo[]>(`https://jsonplaceholder.typicode.com/todos?userId=${userId}`)
}

function createTodo(text: string): Observable<Todo> {
   return createEffect(
      inject(HttpClient).post<Todo>('https://jsonplaceholder.typicode.com/todos', {text}),
      mergeAll()
   )
}

function updateTodo(todo: Todo): Observable<Todo> {
   return createEffect(
      inject(HttpClient).put<Todo>(`https://jsonplaceholder.typicode.com/todos/${todo.id}`, todo),
      exhaustAll()
   )
}
