import {Observable, Subject} from "rxjs";
import {EnvironmentInjector, Injector} from "@angular/core";

export interface Query {
   queryKey: any[]
}

export interface PartialQueryFilter {
   name?: string
   params?: any[]
   exact?: boolean
}

export interface QueryFilterPredicate {
   (query: Query): boolean
}

export type QueryFilter =
   | PartialQueryFilter
   | QueryFilterPredicate

export interface MutationOptions {
   mutate: (...params: any[]) => Observable<any>
   onSettled?: (context: MutationContext) => void
   onError?: (context: MutationContext) => void
   onProgress?: (context: MutationContext) => void
   onSuccess?: (context: MutationContext) => void
   onMutate?: (context: MutationContext) => void
   injector?: Injector
}

export interface MutationContext {
   params: unknown[]
   error: unknown
   value: unknown
   values: unknown[]
}

export interface QueryState<TParams extends any[], TResult, TData = TResult, TPageParam = unknown> {
   data: TData | null
   updatedAt: number
   isInitial: boolean
   error: unknown
   pages: Page<TParams, TResult, TData, TPageParam>[]
}

export interface FetchParams<TParams extends any[], TResult, TData = TResult, TPageParam = unknown> {
   queryFn: (...params: unknown extends TPageParam ? TParams : [TPageParam, ...TParams]) => Observable<any>
   queryParams: TParams
   options?: QueryOptions<TParams, TResult, TData, TPageParam>
   refresh?: boolean
   pages?: Page<TParams, TData, TParams>[]
}

export interface LoadingEvent<TParams extends any[], TResult, TData = TResult, TPageParam = unknown> {
   readonly type: "loading"
   readonly fetch: FetchParams<TParams, TResult, TData, TPageParam>
   readonly state: QueryState<TParams, TResult, TData, TPageParam>
}

export interface SuccessEvent<TParams extends any[], TResult, TData = TResult, TPageParam = unknown> {
   readonly type: "success"
   readonly fetch: FetchParams<TParams, TResult, TData, TPageParam>
   readonly state: QueryState<TParams, TResult, TData, TPageParam>
}

export interface ProgressEvent<TParams extends any[], TResult, TData = TResult, TPageParam = unknown> {
   readonly type: "progress"
   readonly fetch: FetchParams<TParams, TResult, TData, TPageParam>
   readonly state: QueryState<TParams, TResult, TData, TPageParam>
}

export interface ErrorEvent<TParams extends any[], TResult, TData = TResult, TPageParam = unknown> {
   readonly type: "error"
   readonly fetch: FetchParams<TParams, TResult, TData, TPageParam>
   readonly state: QueryState<TParams, TResult, TData, TPageParam>
}

export interface InitialEvent<TParams extends any[], TResult, TData = TResult, TPageParam = unknown> {
   readonly type: "initial"
   readonly fetch: FetchParams<TParams, TResult, TData, TPageParam>
   readonly state: QueryState<TParams, TResult, TData, TPageParam>
}

export interface MutationEvent<TParams extends any[], TResult, TData = TResult, TPageParam = unknown> {
   readonly type: "mutation"
   readonly fetch: FetchParams<TParams, TResult, TData, TPageParam>
   readonly state: QueryState<TParams, TResult, TData, TPageParam>
}

export type QueryEvent<TParams extends any[] = unknown[], TResult = unknown, TData = TResult, TPageParam = unknown> =
   | InitialEvent<TParams, TResult, TData, TPageParam>
   | LoadingEvent<TParams, TResult, TData, TPageParam>
   | SuccessEvent<TParams, TResult, TData, TPageParam>
   | ProgressEvent<TParams, TResult, TData, TPageParam>
   | ErrorEvent<TParams, TResult, TData, TPageParam>
   | MutationEvent<TParams, TResult, TData, TPageParam>

export interface Page<TParams extends any[], TResult, TData = TResult, TPageParam = unknown> extends QueryState<TParams, TResult, TData, TPageParam> {
   params: TParams
   currentPage: TPageParam,
   nextPage?: TPageParam
   previousPage?: TPageParam
}

export type QueryStore = Map<string, {
   fetch: Subject<FetchParams<unknown[], unknown>>
   result: Observable<QueryEvent>
}>

export interface QueryOptions<TParams extends any[], TResult, TData = TResult, TPageParam = unknown> {
   key: string | ((params: TParams) => any)
   fetch: (...params: TParams) => Observable<TResult>
   cacheTime?: number
   store?: QueryStore
   refreshInterval?: number
   previousPage?: (result: TResult) => TPageParam | undefined
   nextPage?: (result: TResult) => TPageParam | undefined
   select?: (result: TResult) => TData
   keepPreviousData?: boolean
   staleTime?: number
   injector?: Injector
}
