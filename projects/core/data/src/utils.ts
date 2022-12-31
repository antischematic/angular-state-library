import {
   EMPTY,
   map,
   materialize,
   MonoTypeOperatorFunction,
   Observable,
   ObservableNotification,
   scan,
   startWith,
   switchMap
} from "rxjs";
import {
   ErrorEvent,
   FetchParams,
   InitialEvent,
   LoadingEvent,
   ProgressEvent,
   QueryEvent,
   QueryState,
   SuccessEvent
} from "./interfaces";
import {EnvironmentInjector} from "@angular/core";

export const noop = () => EMPTY

export const INITIAL_STATE: QueryState<any, any, any, any> = Object.freeze({
   isInitial: true,
   isFetching: false,
   isProgress: false,
   isSuccess: false,
   isPreviousData: false,
   data: null,
   hasError: false,
   error: null,
   pages: [],
   updatedAt: 0
})

export const createInitialEvent = (): InitialEvent<any, any, any, any> => Object.freeze({
   type: "initial",
   fetch: {
      queryFn: noop,
      queryParams: [],
      options: {
         key: "",
         fetch: noop
      }
   },
   state: INITIAL_STATE
})

export function createFetch<T>(environmentInjector: EnvironmentInjector, operator: MonoTypeOperatorFunction<T> = (source: any) => source) {
   return (source: Observable<FetchParams<any[], any>>) => source.pipe(
      switchMap((fetch) => {
         const queryParams = fetch.refresh && fetch.pages?.length ? [fetch.pages[0].currentPage, ...fetch.queryParams.slice(1)] : fetch.queryParams
         return environmentInjector.runInContext(() => fetch.queryFn(...queryParams)).pipe(
            operator,
            materialize(),
            startWith({kind: "F"} as const),
            map(result => {
               return { ...result, fetch }
            })
         )
      }),
   )
}

export function createResult(initialEvent: QueryEvent = createInitialEvent(), mapResult: any = (event: any) => event) {
   return (source: Observable<(ObservableNotification<any> | { kind: "F" }) & { fetch: FetchParams<any[], any> }>) => source.pipe(
      scan(({ state }, event) => {
         const updatedAt = Date.now()
         switch (event.kind) {
            case "F": {
               return mapResult({
                  type: "loading",
                  fetch: event.fetch,
                  state: { ...state, updatedAt: 0, hasError: false, error: null, state: "fetch" },
               } as LoadingEvent<any[], any>)
            }
            case "N": {
               return mapResult({
                  type: "progress",
                  fetch: event.fetch,
                  value: event.value,
                  state: { ...state, updatedAt: 0, data: event.value, state: "progress" }
               }) as ProgressEvent<any[], any>
            }
            case "E": {
               return mapResult({
                  type: "error",
                  fetch: event.fetch,
                  error: event.error,
                  state: { ...state, updatedAt, isInitial: false, error: event.error, state: "error" }
               }) as ErrorEvent<any[], any>
            }
            case "C": {
               return mapResult({
                  type: "success",
                  fetch: event.fetch,
                  state: { ...state, updatedAt, isInitial: false, state: "success" }
               }) as SuccessEvent<any[], any>
            }
         }
      }, initialEvent)
   )
}

