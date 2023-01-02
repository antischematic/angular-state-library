import {HttpClient} from "@angular/common/http";
import {inject} from "@angular/core";
import {Transition, useTransition} from "@antischematic/angular-state-library"
import {MutationClient} from "@antischematic/angular-state-library/data";
import {forkJoin, Observable} from "rxjs";
import {Todo} from "../interfaces";

const endpoint = `https://jsonplaceholder.typicode.com/todos`

export default function toggleAll(todos: Todo[], transition: Transition<Todo[]>): Observable<Todo[]> {
   const http = inject(HttpClient)
   const mutation = new MutationClient({
      mutate() {
         return forkJoin(todos.map(todo => http.put<Todo>(`${endpoint}/${todo.id}`, { ...todo, completed: !todo.completed}))).pipe(
            useTransition(transition),
         );
      },
      onSettled({ invalidateQueries }) {
         invalidateQueries({
            name: "todos"
         })
      }
   })
   return mutation.mutate()
}
