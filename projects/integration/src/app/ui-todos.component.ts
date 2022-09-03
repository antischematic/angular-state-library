import {
   $,
   Action,
   Caught,
   createDispatch,
   createEffect,
   fromAction as fromStore,
   Invoke,
   Layout,
   Select,
   Store,
   Queue, loadEffect,
} from '@mmuscat/angular-state-library';
import { UITodo } from './ui-todo.component';
import {delay, forkJoin, mergeAll, Observable, switchAll} from 'rxjs';
import { HttpClient } from '@angular/common/http';
import {
   ChangeDetectionStrategy,
   Component,
   inject,
   Input,
   QueryList,
   ViewChildren,
} from '@angular/core';
import { Todo } from './interfaces';
import { CommonModule } from '@angular/common';
import { UISpinner } from './spinner.component';

@Store()
@Component({
   imports: [UITodo, UISpinner, CommonModule],
   selector: 'ui-todos',
   standalone: true,
   changeDetection: ChangeDetectionStrategy.OnPush,
   templateUrl: './ui-todos.component.html',
})
export class UITodos {
   @Input() userId!: string;

   @Queue() pending = false;

   @ViewChildren(UITodo)
   uiTodos!: QueryList<UITodos>;

   todos: Todo[] = [];

   @Select() get remaining() {
      return this.todos.filter((todo) => !todo.completed);
   }

   @Select() get completed() {
      return this.todos.filter((todo) => todo.completed);
   }

   @Invoke() loadTodos() {
      // Invoke, Before and Layout react to changes on "this"
      return dispatch(loadTodos(this.userId), {
         next(todos) {
            this.todos = todos;
         },
      });
   }

   @Layout() countElements() {
      // Use "$" to track arbitrary objects
      const { length } = $(this.uiTodos);
      console.log(
         `There ${length === 1 ? 'is' : 'are'} now ${length} <ui-todo> element${
            length === 1 ? '' : 's'
         } on the page`
      );
   }

   @Action() createTodo(todo: Todo) {
      return dispatch(createTodo(this.userId, todo.title), {
         finalize: this.loadTodos,
      });
   }

   @Action() updateTodo(todo: Todo) {
      return dispatch(updateTodo(todo), {
         error(error) {
            console.log('error observed, rethrowing', error);
            throw error;
         },
         finalize: this.loadTodos,
      });
   }

   @Action() toggleAll(todos: Todo[]) {
      return dispatch(toggleAll(todos), {
         finalize: this.loadTodos,
      });
   }

   // create a todo then toggle complete to trigger an error
   @Caught() handleError(error: unknown) {
      console.log('error caught, rethrowing', error);
      throw error;
   }

   @Invoke() logEvents() {
      // observe events from a store
      fromStore(UITodos).subscribe((event) => {
         const name = Object.getPrototypeOf(event.context).constructor.name;
         console.log(`${name}:${event.name as string}:${event.type}`, event);
      });
   }

   trackById(_: number, value: Todo) {
      return value.id;
   }
}

function loadTodos(userId: string): Observable<Todo[]> {
   return inject(HttpClient).get<Todo[]>(
      `https://jsonplaceholder.typicode.com/todos`,
      { params: { userId } }
   );
}

function createTodo(userId: string, title: string): Observable<Todo> {
   return createEffect(
      inject(HttpClient).post<Todo>(
         'https://jsonplaceholder.typicode.com/todos',
         { userId, title }
      ),
      mergeAll()
   );
}

const updateTodo = loadEffect(() => import("./effects/update-todo"))
const toggleAll = loadEffect(() => import("./effects/toggle-all"))

const dispatch = createDispatch(UITodos);
