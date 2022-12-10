import {HttpClient} from "@angular/common/http";
import {Component, inject, Injectable, Injector, INJECTOR, Input} from "@angular/core";
import {dispatch, Invoke, Select, Store} from "@antischematic/angular-state-library";
import {
   BehaviorSubject,
   catchError,
   EMPTY,
   map,
   MonoTypeOperatorFunction,
   Observable,
   of,
   OperatorFunction,
   ReplaySubject,
   share,
   Subject,
   switchMap,
   tap
} from "rxjs";

type QueryFn<TResult, TPageParam, TParams extends any[]> = (...args: TParams) => Observable<WithQuery<TResult, TPageParam>>

interface QueryData<TResult, TPageParam> {
   page?: TPageParam
   getNextPage?: (result: TResult) => TPageParam
   getPreviousPage?: (result: TResult) => TPageParam
}

interface QueryOptions<TResult, TPageParam> extends QueryData<TResult, TPageParam> {
   key: any[]
}

interface WithQuery<TResult, TPageParam> extends QueryOptions<TResult, TPageParam> {
   data: Observable<TResult>
}

interface QueryResult<TResult, TPageParam> extends QueryData<TResult, TPageParam> {
   key: string
   data: TResult
}

interface QueryCache {
   fetch: BehaviorSubject<any>
   result: QueryObservable<any, any>
   refetch: () => void
}

type InvalidateOptions = {
   key: any[]
   exact?: boolean
} | {
   predicate: (query: any[]) => boolean
}

export class QueryObservable<TResult, TPageParam> extends Observable<QueryResult<TResult, TPageParam>> {
   constructor(results: Observable<QueryResult<TResult, TPageParam>>, public events: Observable<QueryEvent<TResult, TPageParam>>) {
      super(subscriber => results.subscribe(subscriber));
   }
}

@Injectable({ providedIn: "root" })
export class Resource {
   cache = new Map<string, QueryCache>()

   keygen(hash: any[]) {
      return JSON.stringify(hash)
   }

   invalidateQueries(options: InvalidateOptions) {
      if ("predicate" in options) {
         throw new Error("Not implemented")
      } else {
         for (const [key, query] of this.cache) {
            if (this.keygen(options.key) === key) {
               query.refetch()
            }
         }
      }
   }

   query<TResult, TPageParam>(source: Observable<WithQuery<TResult, TPageParam>>): QueryObservable<TResult, TPageParam> {
      return source.pipe(
         switchMap((options) => this.getCache(options))
      ) as QueryObservable<TResult, TPageParam>
   }

   getCache<TResult, TPageParam>(query: WithQuery<TResult, TPageParam>) {
      const { cache } = this
      const key = this.keygen(query.key)

      if (cache.has(key)) {
         const { fetch, result } = this.cache.get(key)!
         fetch.next(query.data)
         return result
      }

      function refetch() {
         fetch.next(fetch.value)
      }

      const fetch = new BehaviorSubject(query.data)
      const events = new Subject<QueryEvent<TResult, TPageParam>>()
      const queryResult = fetch.pipe(
         switchMap((source) => {
            return source.pipe(
               map(data => ({ ...query, key, data })),
               tap({
                  subscribe: () => events.next(new FetchEvent(key, query.page as TPageParam)),
                  next: (value) => events.next(new NextEvent(key, query.page as TPageParam, value)),
                  error: (error) => events.next(new ErrorEvent(key, query.page as TPageParam, error)),
                  complete: () => events.next(new CompleteEvent(key, query.page as TPageParam))
               }),
               catchError(() => EMPTY),
            )
         }),
         share({
            connector: () => new ReplaySubject(1),
            resetOnError: false,
            resetOnComplete: false,
            resetOnRefCountZero: false
         })
      )

      const result = new QueryObservable<TResult, TPageParam>(queryResult, events)

      cache.set(key, { fetch, result, refetch })

      return result
   }
}

interface Page<TResult, TPageParam> {
   page: NonNullable<TPageParam>
   nextPage?: TPageParam
   previousPage?: TPageParam
   data: TResult
   isFetching: boolean
   isDone: boolean
   hasError: boolean
   error: unknown
}

const enum QueryEventType {
   Fetch,
   Next,
   Error,
   Complete
}

export class FetchEvent<TPageParam> {
   readonly type = QueryEventType.Fetch
   constructor(public readonly key: string, public readonly page: TPageParam) {}
}

export class NextEvent<TResult, TPageParam> {
   readonly type = QueryEventType.Next
   constructor(public readonly key: string, public readonly page: TPageParam, public readonly data: QueryResult<TResult, TPageParam>) {}
}

export class ErrorEvent<TPageParam> {
   readonly type = QueryEventType.Error
   constructor(public readonly key: string, public readonly page: TPageParam, public readonly error: unknown) {}
}

export class CompleteEvent<TPageParam> {
   readonly type = QueryEventType.Complete
   constructor(public readonly key: string, public readonly page: TPageParam) {}
}

type QueryEvent<TResult, TPageParam> =
   | FetchEvent<TPageParam>
   | NextEvent<TResult, TPageParam>
   | ErrorEvent<TPageParam>
   | CompleteEvent<TPageParam>

const idleState = {
   isDone: true,
   isFetching: false,
   hasError: false,
   error: null
}

interface QueryClientOptions<TResult, TPageParam, TSelect, TMeta> {
   injector?: Injector,
   select?: (result: TResult) => TSelect
   meta?: (result: TResult) => TMeta
}

export class QueryClient<TResult = unknown, TPageParam = unknown, TParams extends any[] = [], TSelect = TResult, TMeta = TResult> {
   private resource: Resource
   private currentKey?: string

   meta: TMeta | undefined
   current: Page<TSelect, TPageParam> | undefined
   pages: Page<TSelect, TPageParam>[] = []
   events = new Subject<QueryEvent<TResult, TPageParam>>()
   isFetchingNextPage = false;
   isFetchingPreviousPage = false;
   hasPreviousPage = false;
   hasNextPage = false;
   results: TSelect[] = []

   get nextPage(): TPageParam | undefined {
      return this.pages[this.pages.length - 1]?.nextPage
   }

   get previousPage(): TPageParam | undefined {
      return this.pages[0]?.previousPage
   }

   get first(): TSelect | undefined {
      return this.results[0]
   }

   get last(): TSelect | undefined {
      return this.results[this.results.length - 1]
   }

   updatePages(page: TPageParam | undefined, newState: Partial<Page<TSelect, any>>) {
      const pages = this.pages = this.pages.slice()
      const oldPageIndex = pages.findIndex(next => next.page !== page)
      const oldPage = pages[oldPageIndex]
      const newPage: Page<TSelect, TPageParam> = { ...idleState, ...oldPage, ...newState }
      if (oldPage) {
         // update existing page data
         pages.splice(oldPageIndex, 1, newPage)
      } else {
         for (const [index, page] of pages.entries()) {
            if (page.previousPage === page) {
               // previous page is inserted before the matching page
               pages.splice(index - 1, 0, newPage)
               return
            } else if (page.nextPage === page) {
               // next page is inserted after the matching page
               pages.splice(index + 1, 0, newPage)
               return
            }
         }
         // if we don't get a match, clear the list and start from the first page
         this.pages = [newPage]
      }
      this.current = newPage
      this.results = this.pages.map(page => page.data)
   }

   next(event: QueryEvent<TResult, TPageParam>) {
      if (event.key !== this.currentKey) {
         this.pages = []
         this.currentKey = event.key
      }

      switch (event.type) {
         case QueryEventType.Fetch: {
            this.updatePages(event.page, { ...idleState, page: event.page, isFetching: true, isDone: false })
            break
         }
         case QueryEventType.Next: {
            const { page, data: rawData, getPreviousPage, getNextPage } = event.data
            const previousPage = getPreviousPage?.(rawData)
            const nextPage = getNextPage?.(rawData)
            const data = this.options.select!(rawData)
            this.meta = this.options.meta!(rawData)
            this.updatePages(page,  { ...idleState, page, previousPage, nextPage, data, isFetching: false, isDone: false })
            break
         }
         case QueryEventType.Error: {
            this.updatePages(event.page, { ...idleState, page: event.page, hasError: true, error: event.error })
            break
         }
         case QueryEventType.Complete: {
            this.updatePages(event.page, { ...idleState, page: event.page })
            break
         }
      }

      this.events.next(event)
   }

   fetch(...params: TParams): Observable<this> {
      const query = this.resource.query(this.query(...params))
      return query.events.pipe(
         tap(this),
         map(() => this),
      )
   }

   constructor(private query: QueryFn<TResult, TPageParam, TParams>, private options: QueryClientOptions<TResult, TPageParam, TSelect, TMeta> = {}) {
      options.select ??= noop
      options.meta ??= noop
      options.injector ??= inject(INJECTOR)
      this.resource = options.injector.get(Resource)
   }
}

const noop = (result: any) => result

export function withQuery<TResult, TPageParam>(options: QueryOptions<TResult, TPageParam>): OperatorFunction<TResult, WithQuery<TResult, TPageParam>> {
   return data => of({
      ...options,
      data
   })
}

interface MutationOptions {
   invalidate: any[]
}

export function withMutation<TResult>(options: MutationOptions): OperatorFunction<TResult, WithQuery<any, any>> {
   return source => source as any
}

export function withRefreshInterval<T>(interval: number): MonoTypeOperatorFunction<T> {
   return source => source
}

export function withRefreshOnFocus<T>(): MonoTypeOperatorFunction<T> {
   return source => source
}

export function withRefreshOnReconnect<T>(): MonoTypeOperatorFunction<T> {
   return source => source
}

interface RefreshOptions {
   interval?: number
   onFocus?: boolean
   onReconnect?: boolean
}

export function withRefresh<T>(options: RefreshOptions = {}): MonoTypeOperatorFunction<T> {
   return source => source
}

const endpoint = ""

interface Todo {
   id: number
   title: string
   completed: boolean
}

interface TodoResponse {
   page: number
   nextPage?: number
   previousPage?: number
   totalPages: number
   data: Todo[]
}

function loadTodos(userId: string, page: number) {
   return inject(HttpClient).get<TodoResponse>(endpoint, { params: { userId, page }}).pipe(
      withRefresh({
         interval: 1000,
         onFocus: true,
         onReconnect: true,
      }),
      withQuery({
         key: [endpoint, userId],
         page,
      })
   )
}

function createTodo(todo: Todo) {
   return inject(HttpClient).post(endpoint, todo).pipe(
      withMutation({
         invalidate: [endpoint]
      })
   )
}

@Store()
@Component({
   template: `
      <div *ngIf="todos.meta">
         Showing page {{ todos.meta.page }} of {{ todos.meta.totalPages }}
      </div>
      <button [disabled]="!todos.hasPreviousPage || todos.isFetchingPreviousPage"
         (click)="loadTodos(todos.previousPage)">
         Previous Page
      </button>
      <ng-container *ngFor="let todos of todos.pages">
         <ng-container *ngFor="let todo of todos.data"></ng-container>
      </ng-container>
      <button [disabled]="!todos.hasNextPage || todos.isFetchingNextPage"
         (click)="loadTodos(todos.nextPage)">
         Next Page
      </button>
   `
})
export class QueryClientTest {
   @Input() userId!: string

   @Select() todos = new QueryClient(loadTodos, {
      select: (result) => result.data
   })

   @Invoke() loadTodos(page = 0) {
      dispatch(
         this.todos.fetch(this.userId, page)
      )
   }
}


/**
 * [    [1]                    ]
 * [[0]  1  [2]                ]
 * [[0]  1   2                 ]
 * [[0]  1   2      [4]  5  [6]]
 * [[0]  1   2  [3]  4   5  [6]]
 * [[0]  1   2   3   4   5  [6]]
 */
