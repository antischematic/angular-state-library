import {Observable, ObservableInput, OperatorFunction} from "rxjs";

export const operators = new WeakMap()

export function createEffect<T>(source: Observable<T>, operator: OperatorFunction<ObservableInput<T>, T>): Observable<T> {
   operators.set(source, operator)
   return source
}
