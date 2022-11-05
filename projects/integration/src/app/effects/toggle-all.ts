import {HttpClient} from "@angular/common/http";
import {inject} from "@angular/core";
import {Todo} from "../interfaces";
import {forkJoin, Observable} from "rxjs";
import {useMutation} from "@antischematic/angular-state-library"

const endpoint = `https://jsonplaceholder.typicode.com/todos`

export default function toggleAll(todos: Todo[]): Observable<Todo[]> {
   const http = inject(HttpClient)
   return forkJoin(todos.map(todo => http.put<Todo>(`${endpoint}/${todo.id}`, { ...todo, completed: !todo.completed}))).pipe(
      useMutation({ invalidate: [endpoint] })
   );
}
