import {Todo} from "../interfaces";
import {mergeAll, Observable} from "rxjs";
import {createEffect} from "@mmuscat/angular-state-library";
import {inject} from "@angular/core";
import {HttpClient} from "@angular/common/http";

export default function updateTodo(todo: Todo): Observable<Todo> {
   return createEffect(
      inject(HttpClient).put<Todo>(
         `https://jsonplaceholder.typicode.com/todos/${todo.id}`,
         todo
      ),
      mergeAll()
   );
}
