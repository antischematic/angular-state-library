import {HttpClient} from "@angular/common/http";
import {inject} from "@angular/core";
import {Transition, useMutation, useTransition} from "@antischematic/angular-state-library"
import {forkJoin, Observable} from "rxjs";
import {Todo} from "../interfaces";

const endpoint = `https://jsonplaceholder.typicode.com/todos`

export default function toggleAll(todos: Todo[], transition: Transition<any>): Observable<Todo[]> {
   const http = inject(HttpClient)
   return forkJoin(todos.map(todo => http.put<Todo>(`${endpoint}/${todo.id}`, { ...todo, completed: !todo.completed}))).pipe(
      useTransition(transition),
      useMutation({ invalidate: [endpoint] })
   );
}
