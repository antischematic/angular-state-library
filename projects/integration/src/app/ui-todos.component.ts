import {
   Action, Caught,
   createDispatch,
   createEffect,
   Invoke, Queue,
   Select,
   Store,
} from '@mmuscat/angular-state-library';
import { UITodo } from './ui-todo.component';
import { mergeAll, Observable, switchAll } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import {
   ChangeDetectionStrategy,
   Component,
   inject,
   Input,
} from '@angular/core';
import { Todo } from './interfaces';
import { CommonModule } from '@angular/common';

@Store()
@Component({
   imports: [UITodo, CommonModule],
   selector: 'ui-todos',
   standalone: true,
   changeDetection: ChangeDetectionStrategy.OnPush,
   templateUrl: './ui-todos.component.html',
})
export class UITodos {
   @Input() userId!: string;

   @Queue() pending = false;

   todos: Todo[] = [];

   @Select() get remaining() {
      return this.todos.filter((todo) => !todo.completed);
   }

   @Select() get completed() {
      return this.todos.filter((todo) => todo.completed);
   }

   @Invoke() loadTodos() {
      return dispatch(loadTodos(this.userId), {
         next(todos) {
            this.todos = todos;
         },
      });
   }

   @Action() createTodo(todo: Todo) {
      return dispatch(createTodo(this.userId, todo.title), {
         finalize: this.loadTodos,
      });
   }

   @Action() updateTodo(todo: Todo) {
      return dispatch(updateTodo(todo), {
         finalize: this.loadTodos
      });
   }

   @Caught() handleError(error: unknown) {
      console.log('error caught, rethrowing')
      throw error
   }

   trackById(_: number, value: Todo) {
      return value.id;
   }
}

function loadTodos(userId: string): Observable<Todo[]> {
   return inject(HttpClient).get<Todo[]>(
      `https://jsonplaceholder.typicode.com/todos`,
      { params: { userId } }
   )
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

function updateTodo(todo: Todo): Observable<Todo> {
   return createEffect(
      inject(HttpClient).put<Todo>(
         `https://jsonplaceholder.typicode.com/todos/${todo.id}`,
         todo
      ),
      mergeAll()
   );
}

const dispatch = createDispatch(UITodos);
