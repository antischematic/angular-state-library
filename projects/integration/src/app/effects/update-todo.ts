import {useMerge} from "@antischematic/angular-state-library";
import {MutationClient} from "@antischematic/angular-state-library/data";
import {Todo} from "../interfaces";
import {Observable} from "rxjs";
import {inject} from "@angular/core";
import {HttpClient} from "@angular/common/http";

const endpoint = `https://jsonplaceholder.typicode.com/todos`

export default function updateTodo(todo: Todo): Observable<Todo> {
   useMerge()
   const mutation = new MutationClient({
      mutate: () => inject(HttpClient).put<Todo>(`${endpoint}/${todo.id}`, todo),
      onSettled({ invalidateQueries }) {
         invalidateQueries({
            name: "todos",
         })
      }
   })
   return mutation.mutate()
}
