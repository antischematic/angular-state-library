import {Todo} from "../interfaces";
import {forkJoin, Observable} from "rxjs";
import updateTodo from "./update-todo";

export default function toggleAll(todos: Todo[]): Observable<Todo[]> {
   return forkJoin(
      todos.map(todo => updateTodo({ ...todo, completed: !todo.completed}))
   );
}
