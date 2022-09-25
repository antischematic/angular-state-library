import {Todo} from "../interfaces";
import {Observable} from "rxjs";
import {useMerge} from "@antischematic/angular-state-library";
import {inject} from "@angular/core";
import {HttpClient} from "@angular/common/http";

export default function updateTodo(todo: Todo): Observable<Todo> {
   useMerge()
   return inject(HttpClient).put<Todo>(
      `https://jsonplaceholder.typicode.com/todos/${todo.id}`,
      todo
   )
}
