import {inject, InjectionToken} from "@angular/core";
import {discardPeriodicTasks, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {subscribeSpyTo} from "@hirez_io/observer-spy";
import {
   BehaviorSubject, distinctUntilChanged, EMPTY, expand,
   interval, last, map, materialize, merge, mergeWith, MonoTypeOperatorFunction, NEVER,
   Observable,
   of, repeat, repeatWhen,
   ReplaySubject, sample, scan, share, skip, startWith, Subject,
   Subscription,
   switchAll, switchMap, take, takeUntil, tap, timer, withLatestFrom
} from "rxjs";
import {arrayContaining, eventsContaining} from "./utils/event-matcher";
import createSpy = jasmine.createSpy;


interface QueryState {
   data: unknown
   isFetching: boolean
   isProgress: boolean
   isSuccess: boolean
   hasError: boolean
   error: unknown
   pages: any[]
}

const INITIAL_STATE: QueryState = {
   isFetching: false,
   isProgress: false,
   isSuccess: false,
   data: null,
   hasError: false,
   error: null,
   pages: []
}

const INITIAL_EVENT: InitialEvent = {
   type: "initial",
   fetch: {
      queryParams: []
   },
   state: INITIAL_STATE
}

interface FetchParams {
   queryParams: any[]
}

interface FetchEvent {
   readonly type: "fetch"
   readonly fetch: FetchParams
   readonly state: QueryState
}

interface SuccessEvent {
   readonly type: "success"
   readonly fetch: FetchParams
   readonly state: QueryState
}

interface ProgressEvent {
   readonly type: "progress"
   readonly fetch: FetchParams
   readonly state: QueryState
}

interface ErrorEvent {
   readonly type: "error"
   readonly fetch: FetchParams
   readonly state: QueryState
}

interface InitialEvent {
   readonly type: "initial"
   readonly fetch: FetchParams
   readonly state: QueryState
}

type QueryEvent =
   | InitialEvent
   | FetchEvent
   | SuccessEvent
   | ProgressEvent
   | ErrorEvent

function getInvalidators(invalidate: Observable<any>, options: QueryOptions) {
   if (options.refreshInterval) {
      invalidate = invalidate.pipe(
         mergeWith(timer(options.refreshInterval))
      )
   }
   return invalidate
}

interface Page extends QueryState {
   queryParams: any[]
   currentPage: any,
   nextPage?: any
   previousPage?: any
}

const NO_PAGE = Symbol("No page")

function upsertPage(state: any, cursor: any, pages: Page[], mode: 0 | 1) {
   pages = pages.slice()
   for (const [index, page] of pages.entries()) {
      if (page.previousPage === cursor) {
         pages.splice(index - 1, mode, state)
         return pages
      }
      if (page.nextPage === cursor) {
         pages.splice(index + 1, mode, state)
         return pages
      }
   }
   return [state]
}

function createPages(query: QueryClient, queryFn: (...params: any[]) => Observable<any>, options: QueryOptions) {
   return (source: Observable<FetchParams>) => source.pipe(
      createResult(query, queryFn, () => EMPTY),
      map((event) => {
         const { type, fetch: { queryParams: [pageIndex] } } = event
         const page = { currentPage: pageIndex, queryParams: event.fetch.queryParams } as Page
         switch (type) {
            case "fetch":
               event.state.pages = upsertPage(page, pageIndex, event.state.pages, 0)
               return event
            // @ts-ignore
            case "success":
               page.data = options.select?.(event.state.data) ?? event.state.data
               page.previousPage = options.previousPage?.(event.state.data) ?? NO_PAGE
               page.nextPage = options.nextPage?.(event.state.data) ?? NO_PAGE
            default:
               event.state.pages = upsertPage(page, pageIndex, event.state.pages, 1)
               return event
         }
      })
   )
}

function createInfiniteQuery(query: QueryClient, queryKey: string, queryFn: (...params: any[]) => Observable<any>, store: QueryStore, options: QueryOptions) {
   if (store.has(queryKey)) {
      return store.get(queryKey)!
   }

   const fetch = new ReplaySubject<FetchParams>(1)
   const pages = fetch.pipe(
      createPages(query, queryFn, options),
      shareCache(options)
   )
   const invalidate = new Subject()
   const refresh = pages.pipe(
      sample(getInvalidators(invalidate, options)),
      switchMap(pages =>
         of(pages).pipe(
            expand(({ state: { pages }}) => {
               const page = pages[pages.length - 1]
               if (page?.nextPage) {
                  return fetch.pipe(
                     map((fetchParams) => {
                        return {
                           queryParams: [page.nextPage, ...fetchParams.queryParams.slice(1)]
                        }
                     }),
                     createPages(query, queryFn, options),
                     takeUntil(fetch)
                  )
               }
               return EMPTY
            }),
            last(null, INITIAL_EVENT)
         )
      ),
   )
   const result: Observable<QueryEvent> = pages

   store.set(queryKey, { fetch, result })

   return { fetch, result }
}

function createResult(query: QueryClient, queryFn: (...params: any[]) => Observable<any>, invalidators?: () => Observable<any>) {
   return (source: Observable<FetchParams>) => source.pipe(
      switchMap((fetch) => {
         return queryFn(...fetch.queryParams).pipe(
            repeat({
               delay: invalidators
            }),
            materialize(),
            startWith({kind: "F"} as const),
            map(result => {
               return { ...result, fetch }
            })
         )
      }),
      map((event) => {
         const { state } = query
         switch (event.kind) {
            case "F": {
               return {
                  type: "fetch",
                  fetch: event.fetch,
                  state: { ...state, isFetching: true, isProgress: false, isSuccess: false, hasError: false, error: null, state: "fetch" }
               } as FetchEvent
            }
            case "N": {
               return {
                  type: "progress",
                  fetch: event.fetch,
                  value: event.value,
                  state: { ...state, isProgress: true, data: event.value, state: "progress" }
               } as ProgressEvent
            }
            case "E": {
               return {
                  type: "error",
                  fetch: event.fetch,
                  error: event.error,
                  state: { ...state, isFetching: false, isProgress: false, isSuccess: false, hasError: true, error: event.error, state: "error" }
               } as ErrorEvent
            }
            case "C": {
               return {
                  type: "success",
                  fetch: event.fetch,
                  state: { ...state, isFetching: false, isProgress: false, isSuccess: true, hasError: false, error: null, state: "success" }
               } as SuccessEvent
            }
         }
      })
   )
}

function shareCache<T>(options: QueryOptions): MonoTypeOperatorFunction<T> {
   return share({
      connector: () => new ReplaySubject(1),
      resetOnRefCountZero: () => options.cacheTime ? timer(options.cacheTime) : of(0)
   })
}

function createQuery(query: QueryClient, queryKey: string, queryFn: (...params: any[]) => Observable<any>, store: QueryStore, options: QueryOptions) {
   if (store.has(queryKey)) {
      return store.get(queryKey)!
   }
   const fetch = new ReplaySubject<FetchParams>(1)
   const invalidate = new Subject()
   const invalidators = () => getInvalidators(invalidate, options)
   const result = fetch.pipe(
      createResult(query, queryFn, invalidators),
      shareCache(options)
   )
   store.set(queryKey, { fetch, result })
   return { fetch, result }
}

interface QueryStore extends Map<string, { fetch: Subject<FetchParams>, result: Observable<QueryEvent> }> {}

interface QueryOptions {
   key: string | ((params: any[]) => unknown[])
   fetch: (...params: any[]) => Observable<unknown>
   cacheTime?: number
   store?: QueryStore
   refreshInterval?: number
   previousPage?: (result: any) => any
   nextPage?: (result: any) => any
   select?: (result: any) => any
}

class QueryClient extends Observable<any> {
   params = [] as any[]
   query = new ReplaySubject<Observable<any>>(1)
   connections = 0
   emitter = new BehaviorSubject(this)
   subscription = Subscription.EMPTY
   store: QueryStore
   event: QueryEvent = INITIAL_EVENT
   createQuery

   get isSettled() {
      return this.state.isSuccess || this.state.hasError || this.isInitial
   }

   get isInitial() {
      return this.state === INITIAL_STATE
   }

   get state() {
      return this.event.state
   }

   get value() {
      return this.state
   }

   get isInfinite() {
      return !!this.options.nextPage || !!this.options.previousPage
   }

   get pages() {
      return this.state.pages
   }

   get last() {
      return this.state.pages[this.state.pages.length - 1]
   }

   get first() {
      return this.state.pages[0]
   }

   next(event: QueryEvent) {
      this.event = event
      this.emitter.next(this)
   }

   connect() {
      if (!this.connections++) {
         this.subscription = this.query.pipe(
            distinctUntilChanged(),
            switchAll()
         ).subscribe(this)
      }
   }

   disconnect() {
      if (!--this.connections) {
         this.subscription.unsubscribe()
      }
   }

   fetch(...queryParams: any[]) {
      this.params = []
      const { fetch, result } = this.createQuery(
            this,
            this.getQueryKey(queryParams),
            this.options.fetch,
            this.store,
            this.options
         )
      if (this.isSettled) {
         fetch.next({ queryParams })
      }
      this.query.next(result)
      return this
   }

   fetchNextPage() {
      if (this.last?.nextPage !== NO_PAGE) {
         this.fetch(this.last.nextPage, ...this.params.slice(1))
      }
   }

   getQueryKey(params: any[]) {
      const { key, cacheTime = 300_000 } = this.options
      const segments = typeof key === "string" ? [key, ...params] : key(params)
      return JSON.stringify([segments, cacheTime])
   }

   constructor(private options: QueryOptions) {
      super((observer) => {
         this.connect()
         observer.add(this.emitter.subscribe(observer))
         observer.add(() => this.disconnect())
         return observer
      })

      this.store = options.store ?? inject(QueryStore)
      this.createQuery = this.isInfinite ? createInfiniteQuery : createQuery
   }
}

const noop = () => EMPTY

const QueryStore = new InjectionToken<QueryStore>("QueryStore", {
   factory: () => new Map()
})

interface Query {
   result: Observable<any>
   invalidate(): void
}

describe("Query", () => {
   it("should create", () => {
      const store = new Map()
      const query = new QueryClient({
         key: "query",
         fetch: noop,
         store
      })

      expect(query).toBeInstanceOf(QueryClient)
   })

   it("should fetch data", () => {
      const expected = 0
      const store = new Map()
      const query = new QueryClient({
         key: "query",
         fetch: (value: number) => of(value + 1),
         store
      })

      const result = subscribeSpyTo(query.fetch(expected))

      expect(result.getLastValue()).toBe(query)
   })

   it("should emit the current value on subscribe", () => {
      const store = new Map()
      const query = new QueryClient({
         key: "query",
         fetch: noop,
         store
      })

      const result = subscribeSpyTo(query)

      expect(result.getFirstValue()).toBe(query)
      expect(result.getValuesLength()).toBe(1)
   })

   it("should unsubscribe from the source when there are no more observers", () => {
      const spy = createSpy()
      const store = new Map()
      const query = new QueryClient({
         key: "query",
         fetch: () => interval(0).pipe(tap({ unsubscribe: spy })),
         store,
         cacheTime: 0
      })
      const result = query.subscribe()
      const result2 = query.subscribe()

      query.fetch()

      expect(spy).toHaveBeenCalledTimes(0)

      result.unsubscribe()

      expect(spy).toHaveBeenCalledTimes(0)

      result2.unsubscribe()

      expect(spy).toHaveBeenCalledTimes(1)
   })

   it("should emit events", fakeAsync(() => {
      const expectedEvents = [
         { type: "initial" },
         { type: "fetch" },
         { type: "progress", value: 0 },
         { type: "progress", value: 1 },
         { type: "progress", value: 2 },
         { type: "success" }
      ]
      const store = new Map()
      const query = new QueryClient({
         key: "query",
         fetch: () => interval(1000).pipe(take(3)),
         store
      })
      const result = subscribeSpyTo(query.pipe(map(q => q.event)))

      subscribeSpyTo(query.fetch())
      tick(10000)

      expect(result.getValues()).toEqual(arrayContaining(expectedEvents))
   }))

   it("should return initial state", () => {
      const store = new Map()
      const query = new QueryClient({
         key: "query",
         fetch: noop,
         store
      })

      const result = query.value

      expect(result).toBe(INITIAL_STATE)
   })

   it("should sync queries by their query key", fakeAsync(() => {
      const fetch = () => interval(1000).pipe(take(3))
      const store = new Map()
      const query = new QueryClient({
         key: "todos",
         fetch,
         store,
      })
      const query2 = new QueryClient({
         key: "todos",
         fetch,
         store,
      })

      subscribeSpyTo(query.fetch())
      subscribeSpyTo(query2.fetch())
      tick(1000)

      expect(query.state.data).toBe(0)
      expect(query2.state.data).toBe(query.state.data)

      tick(1000)

      expect(query.state.data).toBe(1)
      expect(query2.state).toBe(query.state)

      tick(1000)

      expect(query.state.data).toBe(2)
      expect(query2.state).toBe(query.state)
   }))

   it("should dedupe new fetch when an existing fetch is in flight", fakeAsync(() => {
      const spy = createSpy()
      const fetch = () => interval(1000).pipe(tap({ subscribe: spy }), take(1))
      const store = new Map()
      const query = new QueryClient({
         key: "todos",
         fetch,
         store,
      })

      subscribeSpyTo(query.fetch())

      expect(spy).toHaveBeenCalledTimes(1)

      query.fetch()

      expect(spy).toHaveBeenCalledTimes(1)

      tick(1000)

      query.fetch()

      expect(spy).toHaveBeenCalledTimes(2)
      discardPeriodicTasks()
   }))

   it("should periodically refresh data after each successful fetch", fakeAsync(() => {
      const spy = createSpy()
      const store = new Map()
      const fetch = () => timer(1000).pipe(tap({ subscribe: spy }))
      const query = new QueryClient({
         key: "todos",
         fetch,
         store,
         refreshInterval: 1000,
      })

      subscribeSpyTo(query.fetch())

      expect(spy).toHaveBeenCalledTimes(1)

      tick(1000)

      expect(spy).toHaveBeenCalledTimes(1)

      tick(1000)

      expect(spy).toHaveBeenCalledTimes(2)

      tick(2000)

      expect(spy).toHaveBeenCalledTimes(3)
      discardPeriodicTasks()
   }))

   it("should fetch next page", () => {
      let cursor = 0
      const store = new Map()
      const fetch = (page: number) => {
         return of({
            data: { page },
            nextCursor: ++cursor
         })
      }
      const query = new QueryClient({
         key: "todos",
         fetch,
         store,
         nextPage: result => result.nextCursor,
         select: result => result.data
      })

      subscribeSpyTo(query.fetch(cursor))

      expect(query.pages).toEqual(arrayContaining([{ data: { page: 0 }}]))

      query.fetchNextPage()

      expect(query.pages).toEqual(arrayContaining([
         { data: { page: 0 }},
         { data: { page: 1 }}
      ]))

      query.fetchNextPage()

      expect(query.pages).toEqual(arrayContaining([
         { data: { page: 0 }},
         { data: { page: 1 }},
         { data: { page: 2 }}
      ]))
   })
})
