import {Todo} from "../interfaces";
import {Observable} from "rxjs";
import {useMerge, useMutation} from "@antischematic/angular-state-library";
import {inject} from "@angular/core";
import {HttpClient} from "@angular/common/http";

const endpoint = `https://jsonplaceholder.typicode.com/todos`

export default function updateTodo(todo: Todo): Observable<Todo> {
   useMerge()
   return inject(HttpClient).put<Todo>(`${endpoint}/${todo.id}`, todo).pipe(
      useMutation({ invalidate: [endpoint, todo.userId!.toString() ]})
   )
}
