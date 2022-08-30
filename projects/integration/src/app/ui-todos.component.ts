import {
   Action,
   createDispatch,
   createEffect,
   Invoke,
   Select,
   Store
} from "@mmuscat/angular-state-library";
import {UITodo} from "./ui-todo.component";
import {mergeAll, Observable, of, tap} from "rxjs";
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
      return dispatch(createTodo(this.userId, todo.title), {
         next: this.loadTodos
      })
   }

   @Action() updateTodo(todo: Todo) {
      return dispatch(updateTodo(this.userId, todo), {
         next: this.loadTodos
      })
   }
}

const dispatch = createDispatch(UITodos)

// fake api
let id = 100
const users = new Map<string, Todo[]>()

function loadTodos(userId: string): Observable<Todo[]> {
   // fake api
   if (users.has(userId)) {
      return of(users.get(userId)!)
   }
   return inject(HttpClient).get<Todo[]>(`https://jsonplaceholder.typicode.com/todos?userId=${userId}`).pipe(
      tap((todos) => users.set(userId, todos))
   )
}


function createTodo(userId: string, title: string): Observable<Todo> {
   // fake api
   users.set(userId, users.get(userId)!.concat({
      id: (id++).toString(),
      userId,
      title,
      completed: false
   }))
   return createEffect(
      inject(HttpClient).post<Todo>('https://jsonplaceholder.typicode.com/todos', {title}),
      mergeAll()
   )
}

function updateTodo(userId: string, todo: Todo): Observable<Todo> {
   // fake api
   users.set(userId, users.get(userId)!.map((existing) => existing.id === todo.id ? todo : existing))
   return createEffect(
      inject(HttpClient).put<Todo>(`https://jsonplaceholder.typicode.com/todos/${todo.id}`, todo),
      mergeAll()
   )
}
