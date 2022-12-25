import {inject, InjectionToken} from "@angular/core";
import {discardPeriodicTasks, fakeAsync, tick} from "@angular/core/testing";
import {subscribeSpyTo} from "@hirez_io/observer-spy";
import {
   BehaviorSubject, delay,
   distinctUntilChanged,
   EMPTY,
   expand,
   filter,
   interval,
   last,
   map,
   materialize,
   merge,
   mergeWith,
   MonoTypeOperatorFunction,
   Observable,
   of,
   repeat,
   ReplaySubject,
   scan,
   share,
   startWith,
   Subject,
   Subscription,
   switchAll,
   switchMap,
   take,
   tap,
   timer, withLatestFrom
} from "rxjs";
import {arrayContaining} from "./utils/event-matcher";
import createSpy = jasmine.createSpy;


interface QueryState {
   data: unknown
   isFetching: boolean
   isProgress: boolean
   isSuccess: boolean
   hasError: boolean
   error: unknown
   pages: Page[]
}

const INITIAL_STATE: QueryState = Object.freeze({
   isFetching: false,
   isProgress: false,
   isSuccess: false,
   data: null,
   hasError: false,
   error: null,
   pages: []
})

const getInitialEvent = (): InitialEvent => ({
   type: "initial",
   fetch: {
      queryParams: []
   },
   state: INITIAL_STATE
})

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

interface Page extends QueryState {
   params: any[]
   currentPage: any,
   nextPage?: any
   previousPage?: any
}

type QueryStore = Map<string, {
   fetch: Subject<FetchParams>
   invalidate: Subject<void>
   result: Observable<QueryEvent>
}>

interface QueryOptions {
   key: string | ((params: any[]) => unknown[])
   fetch: (...params: any[]) => Observable<unknown>
   cacheTime?: number
   store?: QueryStore
   refreshInterval?: number
   previousPage?: (result: any) => any
   nextPage?: (result: any) => any
   select?: (result: any) => any
   keepPreviousData?: boolean
}

function getInvalidators(invalidate: Observable<any>, options: QueryOptions) {
   if (options.refreshInterval) {
      invalidate = invalidate.pipe(
         mergeWith(timer(options.refreshInterval))
      )
   }
   return invalidate
}

const NO_PAGE = Symbol("No page")

function upsertPage(state: any, cursor: any, pages: Page[], mode: number) {
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

function createPages(options: QueryOptions, initialEvent: QueryEvent = getInitialEvent()) {
   return (source: Observable<QueryEvent>) => source.pipe(
      scan((previous, event) => {
         const { type, fetch: { queryParams: [pageIndex, ...params] } } = event
         const previousPage = previous.state.pages.find(page => page.currentPage === pageIndex)
         const page = { ...previousPage, currentPage: pageIndex, params } as Page


         const mode = type === "fetch" ? 0 : 1
         switch (type) {
            // @ts-ignore
            case "success":
               page.data = options.select?.(event.state.data) ?? event.state.data
               page.previousPage = options.previousPage?.(event.state.data) ?? NO_PAGE
               page.nextPage = options.nextPage?.(event.state.data) ?? NO_PAGE
            default:
               return {
                  ...event,
                  state: {
                     ...event.state,
                     pages: upsertPage(page, pageIndex, previous.state.pages, mode)
                  }
               }
         }
      }, initialEvent)
   )
}

function createRefresh(queryFn: (...params: any[]) => Observable<any>, invalidate: Observable<any>, options: QueryOptions) {
   return (events: Observable<QueryEvent>) => events.pipe(
      switchMap(event => {
         if (event.type === "success") {
            const firstPage = event.state.pages[0]
            const pageCount = event.state.pages.length
            const refresh = getInvalidators(invalidate, options).pipe(
               map(() => {
                  return { queryParams: [firstPage.currentPage, ...firstPage.params] }
               }),
               createResult(queryFn, () => EMPTY),
               createPages(options),
               filter(event => event.type === "success"),
               expand((event, index) => {
                  const current: Page = event.state.pages[index]
                  if (current.nextPage) {
                     return of({ queryParams: [current.nextPage, ...current.params] }).pipe(
                        createResult(queryFn, () => EMPTY, event),
                        createPages(options, event),
                        filter(event => event.type === "success"),
                     )
                  }
                  return EMPTY
               }),
               take(pageCount),
               last(),
            )
            return merge(of(event), refresh)
         }
         return of(event)
      })
   )
}

function createInfiniteQuery(queryKey: string, queryFn: (...params: any[]) => Observable<any>, store: QueryStore, options: QueryOptions) {
   if (store.has(queryKey)) {
      return store.get(queryKey)!
   }

   const fetch = new ReplaySubject<FetchParams>(1)
   const invalidate = new Subject<void>()
   const pages = fetch.pipe(
      createResult(queryFn, () => EMPTY),
      createPages(options),
      createRefresh(queryFn, invalidate, options),
      shareCache(options)
   )
   const result: Observable<QueryEvent> = pages

   store.set(queryKey, { fetch, result, invalidate })

   return { fetch, result }
}

function createResult(queryFn: (...params: any[]) => Observable<any>, invalidators: () => Observable<any> = () => EMPTY, initialEvent: QueryEvent = getInitialEvent()) {
   return (source: Observable<FetchParams>) => source.pipe(
      switchMap((fetch) => {
         return queryFn(...fetch.queryParams).pipe(
            materialize(),
            repeat({
               delay: invalidators
            }),
            startWith({kind: "F"} as const),
            map(result => {
               return { ...result, fetch }
            })
         )
      }),
      scan(({ state }, event) => {
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
      }, initialEvent)
   )
}

function shareCache<T>(options: QueryOptions): MonoTypeOperatorFunction<T> {
   return share({
      connector: () => new ReplaySubject(1),
      resetOnRefCountZero: () => options.cacheTime ? timer(options.cacheTime) : of(0)
   })
}

function createQuery(queryKey: string, queryFn: (...params: any[]) => Observable<any>, store: QueryStore, options: QueryOptions) {
   if (store.has(queryKey)) {
      return store.get(queryKey)!
   }
   const fetch = new ReplaySubject<FetchParams>(1)
   const invalidate = new Subject<void>()
   const invalidators = () => getInvalidators(invalidate, options)
   const result = fetch.pipe(
      createResult(queryFn, invalidators),
      shareCache(options)
   )
   store.set(queryKey, { fetch, result, invalidate })
   return { fetch, result }
}

function keepPreviousData(client: QueryClient) {
   return (source: Observable<QueryEvent>) => source.pipe(
      withLatestFrom(client),
      map(([event, client]) => {
         if (event.type === "fetch") {
            const { keepPreviousData } = client.options
            const previousData = keepPreviousData && {
               data: client.state.data,
               pages: client.state.pages
            }
            return {
               ...event,
               state: {
                  ...event.state,
                  ...previousData
               }
            }
         }
         return event
      })
   )
}

class QueryClient extends Observable<QueryClient> {
   params = [] as any[]
   query = new ReplaySubject<Observable<any>>(1)
   connections = 0
   emitter = new BehaviorSubject(this)
   subscription = Subscription.EMPTY
   store: QueryStore
   event: QueryEvent = getInitialEvent()
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
            switchAll(),
            keepPreviousData(this)
         ).subscribe(this)
      }
   }

   disconnect() {
      if (!--this.connections) {
         this.subscription.unsubscribe()
      }
   }

   fetch(...queryParams: any[]) {
      this.params = queryParams
      const { fetch, result } = this.createQuery(
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
      if (this.isInfinite) {
         params = params.slice(1)
      }
      const { key, cacheTime = 300_000 } = this.options
      const segments = typeof key === "string" ? [key, ...params] : key(params)
      return JSON.stringify([segments, cacheTime])
   }

   refetch() {
      const key = this.getQueryKey(this.params)
      if (this.store.has(key)) {
         const { invalidate } = this.store.get(key)!
         invalidate.next()
      }
   }

   constructor(public options: QueryOptions) {
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
      tick(3000)

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

   it("should refresh infinite query", () => {
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

      query.fetchNextPage()
      query.fetchNextPage()
      query.refetch()

      expect(query.pages).toEqual(arrayContaining([
         { data: { page: 0 }},
         { data: { page: 4 }},
         { data: { page: 5 }}
      ]))
   })

   it("should refresh query", () => {
      const spy = createSpy()
      const store = new Map()
      const query = new QueryClient({
         key: "todos",
         fetch: () => of(0).pipe(tap({ subscribe: spy })),
         store
      })

      subscribeSpyTo(query.fetch())

      expect(spy).toHaveBeenCalledTimes(1)

      query.refetch()

      expect(spy).toHaveBeenCalledTimes(2)
   })

   it("should keep previous data", fakeAsync(() => {
      const store = new Map()
      const query = new QueryClient({
         key: "todos",
         fetch: (value: number) => of(value).pipe(delay(1000)),
         store,
         keepPreviousData: true
      })

      subscribeSpyTo(query.fetch(1))
      tick(1000)

      expect(query.state.data).toBe(1)

      query.fetch(2)

      expect(query.state.data).withContext('previous data').toBe(1)

      tick(1000)
      expect(query.state.data).toBe(2)
   }))
})
