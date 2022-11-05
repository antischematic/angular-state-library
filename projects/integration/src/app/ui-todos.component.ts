import {
   $,
   Action,
   Caught,
   dispatch,
   Invoke,
   Layout, loadEffect,
   Select,
   Store, Transition, useMerge,
   events,
   useChanges, useQuery, useMutation, withTransition
} from '@antischematic/angular-state-library';
import {UITodo} from './ui-todo.component';
import {Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {
   ChangeDetectionStrategy,
   Component,
   inject,
   Input,
   QueryList,
   ViewChildren,
} from '@angular/core';
import {Todo} from './interfaces';
import {CommonModule} from '@angular/common';
import {UISpinner} from './spinner.component';
import {UITheme} from "./ui-theme";

@Store()
@Component({
   imports: [UITodo, UISpinner, CommonModule, UITheme],
   selector: 'ui-todos',
   standalone: true,
   changeDetection: ChangeDetectionStrategy.OnPush,
   templateUrl: './ui-todos.component.html',
})
export class UITodos {
   @Input() userId!: string;

   transition = new Transition();

   @ViewChildren(UITodo)

   uiTodos!: QueryList<UITodos>;

   todos: Todo[] = []

   @Select() get remaining() {
      // Use "$" to track nested objects or array mutations
      return $(this.todos).filter((todo) => !todo.completed) ?? [];
   }

   @Select() get completed() {
      return $(this.todos).filter((todo) => todo.completed) ?? [];
   }

   @Action() setTodos(todos: Todo[]) {
      this.todos = todos
   }

   @Invoke() loadTodos() {
      // Invoke, Before and Layout react to changes on "this"
      return dispatch(loadTodos(this.userId, this.transition), {
         next: this.setTodos
      });
   }

   @Layout() countElements() {
      const { length } = $(this.uiTodos);
      console.log(
         `There ${length === 1 ? 'is' : 'are'} now ${length} <ui-todo> element${
            length === 1 ? '' : 's'
         } on the page`
      );
   }

   @Action() createTodo(todo: Todo) {
      return dispatch(createTodo(this.userId, todo.title));
   }

   @Action() updateTodo(todo: Todo) {
      return dispatch(updateTodo(todo), {
         error(error) {
            console.log('error observed, rethrowing', error);
            throw error;
         },
      });
   }

   @Action() toggleAll(todos: Todo[]) {
      return dispatch(toggleAll(todos));
   }

   @Invoke() trackInputChanges() {
      const { userId } = useChanges<UITodos>()
      console.log("inputs changed!", userId)
   }

   // create a todo then toggle complete to trigger an error
   @Caught() handleError(error: unknown) {
      console.log('error caught, rethrowing', error);
      throw error;
   }

   @Invoke() logEvents() {
      // observe events from a store
      events(UITodos).subscribe((event) => {
         const name = Object.getPrototypeOf(event.context).constructor.name;
         console.log(`${name}:${event.name as string}:${event.type}`, event);
      });
   }

   trackById(_: number, value: Todo) {
      return value.id;
   }

   shuffle(array = this.todos) {
      for (let i = array.length - 1; i > 0; i--) {
         const j = Math.floor(Math.random() * (i + 1));
         [array[i], array[j]] = [array[j], array[i]];
      }
   }
}

const endpoint = `https://jsonplaceholder.typicode.com/todos`

function loadTodos(userId: string, loading: Transition): Observable<Todo[]> {
   return inject(HttpClient).get<Todo[]>(endpoint, { params: { userId } }).pipe(
      withTransition(loading),
      useQuery({
         key: [endpoint, userId],
         // refreshInterval: 10000,
         // refreshIfStale: true,
         // staleTime: 10000,
      }),
   )
}

function createTodo(userId: string, title: string): Observable<Todo> {
   useMerge()
   return inject(HttpClient).post<Todo>(endpoint, { userId, title }).pipe(
      useMutation({ invalidate: [endpoint, userId] })
   )
}

const updateTodo = loadEffect(() => import("./effects/update-todo"))
const toggleAll = loadEffect(() => import("./effects/toggle-all"))
