import {inject, InjectionToken} from "@angular/core";
import {discardPeriodicTasks, fakeAsync, tick} from "@angular/core/testing";
import {subscribeSpyTo} from "@hirez_io/observer-spy";
import {
   BehaviorSubject,
   delay,
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
   ReplaySubject,
   scan,
   share,
   startWith,
   Subject,
   Subscription,
   switchAll,
   switchMap,
   switchScan,
   take,
   tap,
   timer
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

interface FetchParams {
   queryFn: (...params: any[]) => Observable<any>
   queryParams: any[]
   options: QueryOptions
   refresh?: boolean
   pages?: Page[]
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

interface RefreshEvent {
   readonly type: "refresh"
   readonly fetch: FetchParams
   readonly state: QueryState
   readonly limit: number
}

type QueryEvent =
   | InitialEvent
   | FetchEvent
   | SuccessEvent
   | ProgressEvent
   | ErrorEvent
   | RefreshEvent

interface Page extends QueryState {
   params: any[]
   currentPage: any,
   nextPage?: any
   previousPage?: any
}

type QueryStore = Map<string, {
   fetch: Subject<FetchParams>
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

const INITIAL_STATE: QueryState = Object.freeze({
   isFetching: false,
   isProgress: false,
   isSuccess: false,
   data: null,
   hasError: false,
   error: null,
   pages: []
})

const getInitialEvent = (): InitialEvent => Object.freeze({
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

function createPages(event: QueryEvent, options: QueryOptions) {
   if (!options.previousPage && !options.nextPage) {
      return event
   }
   const { type, fetch: { queryParams: [pageIndex, ...params] } } = event
   const previousPage = event.state.pages.find(page => page.currentPage === pageIndex)
   const page = { ...previousPage, currentPage: pageIndex, params } as Page

   if (type === "success") {
      page.data = options.select?.(event.state.data) ?? event.state.data
      page.previousPage = options.previousPage?.(event.state.data) ?? NO_PAGE
      page.nextPage = options.nextPage?.(event.state.data) ?? NO_PAGE
   }

   return {
      ...event,
      state: {
         ...event.state,
         pages: upsertPage(page, pageIndex, event.state.pages, type === "fetch" ? 0 : 1)
      }
   }
}

function withInvalidation(client: QueryClient) {
   return (source: Observable<QueryEvent>) => source.pipe(
      switchMap((event) => {
         if (event.type === "success") {
            const refresh = getInvalidators(client.invalidator, client.options).pipe(
               tap(() => {
                  client.fetchInternal(event.fetch.queryParams, { refresh: true })
               })
            )
            return merge(of(event), refresh)
         }
         return of(event)
      })
   )
}

function refreshInfiniteData(options: QueryOptions, pages: Page[] = []) {
   return (source: Observable<FetchParams>) => source.pipe(
      createResult(),
      filter(event => event.type === "success"),
      expand((event, index) => {
         const current: Page = event.state.pages[index]
         if (current.nextPage) {
            return of({ queryFn: event.fetch.queryFn, queryParams: [current.nextPage, ...current.params], options }).pipe(
               createResult(event),
               filter(event => event.type === "success"),
            )
         }
         return EMPTY
      }),
      take(pages.length),
      last(),
   )
}

function createInfiniteQuery(queryKey: string, store: QueryStore, options: QueryOptions) {
   if (store.has(queryKey)) {
      return store.get(queryKey)!
   }

   const fetch = new ReplaySubject<FetchParams>(1)
   const pages = fetch.pipe(
      switchScan((event, fetch) => {
         return fetch.refresh
            ? of(fetch).pipe(
               refreshInfiniteData(options, fetch.pages)
            )
            : of(fetch).pipe(
               createResult(event)
            )
      }, getInitialEvent() as QueryEvent),
      shareCache(options)
   )
   const result: Observable<QueryEvent> = pages

   store.set(queryKey, { fetch, result })

   return { fetch, result }
}

function createResult(initialEvent: QueryEvent = getInitialEvent()) {
   return (source: Observable<FetchParams>) => source.pipe(
      switchMap((fetch) => {
         const queryParams = fetch.refresh && fetch.pages?.length ? [fetch.pages[0].currentPage, ...fetch.queryParams.slice(1)] : fetch.queryParams
         return fetch.queryFn(...queryParams).pipe(
            materialize(),
            startWith({kind: "F"} as const),
            map(result => {
               return { ...result, fetch }
            })
         )
      }),
      scan(({ state }, event) => {
         const { options } = event.fetch
         switch (event.kind) {
            case "F": {
               return createPages({
                  type: "fetch",
                  fetch: event.fetch,
                  state: { ...state, isFetching: true, isProgress: false, isSuccess: false, hasError: false, error: null, state: "fetch" },
               } as FetchEvent, options)
            }
            case "N": {
               return createPages({
                  type: "progress",
                  fetch: event.fetch,
                  value: event.value,
                  state: { ...state, isProgress: true, data: event.value, state: "progress" }
               } as ProgressEvent, options)
            }
            case "E": {
               return createPages({
                  type: "error",
                  fetch: event.fetch,
                  error: event.error,
                  state: { ...state, isFetching: false, isProgress: false, isSuccess: false, hasError: true, error: event.error, state: "error" }
               } as ErrorEvent, options)
            }
            case "C": {
               return createPages({
                  type: "success",
                  fetch: event.fetch,
                  state: { ...state, isFetching: false, isProgress: false, isSuccess: true, hasError: false, error: null, state: "success" }
               } as SuccessEvent, options)
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

function createQuery(queryKey: string, store: QueryStore, options: QueryOptions) {
   if (store.has(queryKey)) {
      return store.get(queryKey)!
   }
   const fetch = new ReplaySubject<FetchParams>(1)
   const result = fetch.pipe(
      createResult(),
      shareCache(options)
   )
   store.set(queryKey, { fetch, result })
   return { fetch, result }
}

function keepPreviousData({ state, options: { keepPreviousData }}: QueryClient, event: QueryEvent) {
   if (event.type === "fetch") {
      const previousData = keepPreviousData && {
         data: state.data,
         pages: state.pages
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
}

class QueryClient extends Observable<QueryClient> {
   params = [] as any[]
   query = new ReplaySubject<Observable<QueryEvent>>(1)
   connections = 0
   emitter = new BehaviorSubject(this)
   subscription = Subscription.EMPTY
   store: QueryStore
   event: QueryEvent = getInitialEvent()
   invalidator = new Subject<void>()
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

   get hasNextPage() {
      return this.last && this.last.nextPage !== NO_PAGE
   }

   get hasPreviousPage() {
      return this.first && this.first.previousPage !== NO_PAGE
   }

   next(event: QueryEvent) {
      this.event = keepPreviousData(this, event)
      this.emitter.next(this)
   }

   connect() {
      if (!this.connections++) {
         this.subscription = this.query.pipe(
            distinctUntilChanged(),
            switchAll(),
            withInvalidation(this)
         ).subscribe(this)
      }
   }

   disconnect() {
      if (!--this.connections) {
         this.subscription.unsubscribe()
      }
   }

   fetch(...queryParams: any[]) {
      this.fetchInternal(queryParams)
      return this
   }

   fetchInternal(queryParams: any[], { refresh = false } = {}) {
      const { fetch, result } = this.createQuery(
         this.getQueryKey(queryParams),
         this.store,
         this.options,
      )
      this.params = queryParams
      if (this.isSettled) {
         fetch.next({ queryFn: this.options.fetch, queryParams, refresh, pages: this.pages, options: this.options })
      }
      this.query.next(result)
   }

   fetchNextPage() {
      if (this.hasNextPage) {
         this.fetch(this.last.nextPage, ...this.params.slice(1))
      }
   }

   fetchPreviousPage() {
      if (this.hasPreviousPage) {
         this.fetch(this.last.previousPage, ...this.params.slice(1))
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
      this.invalidator.next()
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

      expect(query.pages.length).toBe(2)

      query.fetchNextPage()

      expect(query.pages.length).toBe(3)

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

   it("should clear cache when there are no observers after a period of time", fakeAsync(() => {
      let subscription
      const store = new Map()
      const fetch = (value: number) => of(value).pipe(delay(1000))
      const query = new QueryClient({
         key: "todos",
         fetch,
         store,
         cacheTime: 10000
      })

      subscription = subscribeSpyTo(query.fetch(10))

      expect(query.state.data).toBe(null)

      tick(1000)

      expect(query.state.data).toBe(10)
      subscription.unsubscribe()

      tick(10000)

      subscribeSpyTo(query.fetch(10))

      expect(query.state.data).toBe(null)
      discardPeriodicTasks()
   }))
})
