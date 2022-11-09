import {CommonModule} from '@angular/common';
import {HttpClient} from '@angular/common/http';
import {
   ChangeDetectionStrategy,
   Component,
   inject,
   Input,
   QueryList,
   ViewChildren,
} from '@angular/core';
import {
   $,
   Action, Attach,
   Caught,
   dispatch,
   events,
   Invoke,
   Layout,
   loadEffect,
   Select,
   Store,
   TransitionToken,
   useChanges,
   useMerge,
   useMutation,
   useQuery,
   useTransition
} from '@antischematic/angular-state-library';
import {Observable, tap} from 'rxjs';
import updateTodo from './effects/update-todo';
import {Todo} from './interfaces';
import {UISpinner} from './spinner.component';
import {UITheme} from "./ui-theme";
import {UITodo} from './ui-todo.component';

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

   @Attach() transition = inject(Loading)

   @ViewChildren(UITodo) uiTodos!: QueryList<UITodos>;

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
      return dispatch(loadTodos(this.userId), {
         next: this.setTodos
      });
   }

   @Layout() countElements() {
      const {length} = $(this.uiTodos);
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
         },
      });
   }

   @Action() toggleAll(todos: Todo[]) {
      return dispatch(toggleAll(todos, this.transition));
   }

   @Invoke() trackInputChanges() {
      const {userId} = useChanges<UITodos>()
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

const Loading = new TransitionToken<Todo[]>("loading")

function loadTodos(userId: string): Observable<Todo[]> {
   const loading = inject(Loading)
   return inject(HttpClient).get<Todo[]>(endpoint, {params: {userId}}).pipe(
      useTransition(loading, { emit: true }),
      useQuery({
         key: [endpoint, userId],
         // refreshInterval: 5000,
         // refreshOnFocus: true,
         // staleTime: 4950,
      }),
   )
}

function createTodo(userId: string, title: string): Observable<Todo> {
   useMerge()
   return inject(HttpClient).post<Todo>(endpoint, {userId, title}).pipe(
      useMutation({invalidate: [endpoint, userId]})
   )
}

const toggleAll = loadEffect(() => import("./effects/toggle-all"))
