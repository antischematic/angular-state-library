import {InjectionToken} from "@angular/core";
import {discardPeriodicTasks, fakeAsync, tick} from "@angular/core/testing";
import {subscribeSpyTo} from "@hirez_io/observer-spy";
import {
   BehaviorSubject, concatAll,
   delay,
   distinctUntilChanged,
   EMPTY,
   expand,
   filter, from,
   interval,
   last,
   map,
   materialize,
   merge,
   mergeAll,
   mergeWith,
   MonoTypeOperatorFunction,
   Observable,
   of,
   pipe,
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
   throwError,
   timer
} from "rxjs";
import {arrayContaining} from "./utils/event-matcher";
import createSpy = jasmine.createSpy;


interface QueryState {
   data: unknown
   updatedAt: number
   isInitial: boolean
   error: unknown
   pages: Page[]
}

interface FetchParams {
   queryFn: (...params: any[]) => Observable<any>
   queryParams: any[]
   options?: QueryOptions
   refresh?: boolean
   pages?: Page[]
}

interface LoadingEvent {
   readonly type: "loading"
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
   | LoadingEvent
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
   staleTime?: number
}

const INITIAL_STATE: QueryState = Object.freeze({
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

const timers = new Map<number, Observable<number>>()

function getTimer(ms: number) {
   if (!ms) return EMPTY
   if (timers.has(ms)) {
      return timers.get(ms)!
   }
   const refresh = interval(ms).pipe(
      share({
         resetOnRefCountZero: () => {
            timers.delete(ms)
            return of(0)
         }
      })
   )
   timers.set(ms, refresh)
   return refresh
}

function getInvalidators(invalidate: Observable<any>, options: QueryOptions) {
   if (options.refreshInterval) {
      invalidate = invalidate.pipe(
         mergeWith(getTimer(options.refreshInterval))
      )
   }
   return invalidate
}

function upsertPage(state: any, cursor: any, pages: Page[], replace: number) {
   const newPages = pages.slice()
   for (const [index, page] of pages.entries()) {
      if (page.previousPage === cursor) {
         newPages.splice(index - replace, replace, state)
         return newPages
      }
      if (page.nextPage === cursor) {
         newPages.splice(index + 1, replace, state)
         return newPages
      }
   }
   return [state]
}

function createPages(event: QueryEvent) {
   const { options } = event.fetch
   if (!options?.previousPage && !options?.nextPage) {
      return event
   }
   const { type, fetch: { queryParams: [pageIndex, ...params] } } = event
   const previousPage = event.state.pages.find(page => page.currentPage === pageIndex)
   const page = { ...previousPage, currentPage: pageIndex, params } as Page

   if (type === "success") {
      page.data = options.select?.(event.state.data) ?? event.state.data
      page.previousPage = options.previousPage?.(event.state.data)
      page.nextPage = options.nextPage?.(event.state.data)
   }

   return {
      ...event,
      state: {
         ...event.state,
         pages: upsertPage(page, pageIndex, event.state.pages, type === "loading" ? 0 : 1)
      }
   }
}

function refreshInfiniteData(options: QueryOptions, pages: Page[] = []) {
   return (source: Observable<FetchParams>) => source.pipe(
      createInfiniteResult(),
      filter(event => event.type === "success"),
      expand((event, index) => {
         const current: Page = event.state.pages[index]
         if (current.nextPage !== void 0) {
            return of({ queryFn: event.fetch.queryFn, queryParams: [current.nextPage, ...current.params], options }).pipe(
               createInfiniteResult(event),
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
   const result: Observable<QueryEvent> = fetch.pipe(
      switchScan((event, fetch) => {
         return fetch.refresh
            ? of(fetch).pipe(
               refreshInfiniteData(options, fetch.pages)
            )
            : of(fetch).pipe(
               createInfiniteResult(event)
            )
      }, getInitialEvent() as QueryEvent),
      shareCache(store, queryKey, options)
   )

   store.set(queryKey, { fetch, result })

   return { fetch, result }
}

function createInfiniteResult(initialEvent: QueryEvent = getInitialEvent()) {
   return pipe(
      createResult(initialEvent, createPages),
   )
}

function createResult(initialEvent: QueryEvent = getInitialEvent(), mapResult: any = (event: any) => event) {
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
         const updatedAt = Date.now()
         switch (event.kind) {
            case "F": {
               return mapResult({
                  type: "loading",
                  fetch: event.fetch,
                  state: { ...state, updatedAt, hasError: false, error: null, state: "fetch" },
               } as LoadingEvent)
            }
            case "N": {
               return mapResult({
                  type: "progress",
                  fetch: event.fetch,
                  value: event.value,
                  state: { ...state, updatedAt, data: event.value, state: "progress" }
               }) as ProgressEvent
            }
            case "E": {
               return mapResult({
                  type: "error",
                  fetch: event.fetch,
                  error: event.error,
                  state: { ...state, updatedAt, isInitial: false, error: event.error, state: "error" }
               }) as ErrorEvent
            }
            case "C": {
               return mapResult({
                  type: "success",
                  fetch: event.fetch,
                  state: { ...state, updatedAt, isInitial: false, state: "success" }
               }) as SuccessEvent
            }
         }
      }, initialEvent),
   )
}

function shareCache<T>(store: QueryStore, queryKey: string, options: QueryOptions): MonoTypeOperatorFunction<T> {
   return share({
      connector: () => new ReplaySubject(1),
      resetOnRefCountZero: () => {
         return (options.cacheTime ? timer(options.cacheTime) : of(0)).pipe(
            tap(() => store.delete(queryKey))
         )
      }
   })
}

function createQuery(queryKey: string, store: QueryStore, options: QueryOptions) {
   if (store.has(queryKey)) {
      return store.get(queryKey)!
   }
   const fetch = new ReplaySubject<FetchParams>(1)
   const result = fetch.pipe(
      createResult(),
      shareCache(store, queryKey, options)
   )
   store.set(queryKey, { fetch, result })
   return { fetch, result }
}

const globalStore: QueryStore = new Map()

const queries = new Set<QueryClient>()

function stableHash(obj: any) {
   let hash = ""
   const keys: any[] = Object.keys(obj).sort()
   for (const key of keys) {
      const value = obj[key]
      if (typeof value === "object" && value !== null) {
         hash += key + ":" + stableHash(value)
      }
      if (typeof value !== "function") {
         hash += key + ":" + value
      }
   }
   return hash
}

interface Query {
   queryKey: any[]
}

interface PartialQueryFilter {
   params: any[]
   exact?: boolean
}

interface QueryFilterPredicate {
   (query: Query): boolean
}

type QueryFilter =
   | PartialQueryFilter
   | QueryFilterPredicate

function invalidateQueries(filter: QueryFilter = { params: [] }, options: { force?: boolean } = { force: true }) {
   if (typeof filter === "function") {
      throw new Error("Not implemented")
   } else {
      const { params, exact } = filter
      for (const query of Array.from(queries)) {
         let invalidate = params.length === 0
         if (params.length > query.params.length) {
            continue
         }
         for (const [index, param] of query.params.entries()) {
            if (Object.is(params[index], param)) {
               invalidate = true
               if (!exact) {
                  break
               }
            }
         }
         if (invalidate) {
            query.refetch(options)
         }
      }
   }
}

class QueryClient extends Observable<QueryClient> {
   key = ""
   params = [] as any[]
   query = new ReplaySubject<Observable<QueryEvent>>(1)
   connections = 0
   emitter = new BehaviorSubject(this)
   subscription = Subscription.EMPTY
   store: QueryStore
   event: QueryEvent = getInitialEvent()
   invalidator = new Subject<{ force?: boolean } | void>()
   window = false
   createQuery
   sub = Subscription.EMPTY
   previousState?: QueryState

   get data() {
      return this.isPreviousData ? this.previousState!.data : this.value.data
   }

   get isFetching() {
      // todo: implement network mode
      return this.state === "loading"
   }

   get isLoading() {
      return this.state === "loading"
   }

   get isRefetching() {
      return this.isFetching && !this.isInitialLoading
   }

   get isProgress() {
      return this.state === "progress"
   }

   get isSuccess() {
      return this.state === "success"
   }

   get hasError() {
      return this.state === "error"
   }

   get thrownError() {
      return this.value.error
   }

   get isInitialLoading() {
      return this.isFetching && this.value.isInitial
   }

   get isSettled() {
      return this.isSuccess || this.hasError || this.isInitial
   }

   get isInitial() {
      return this.state === "initial"
   }

   get isStale() {
      const { staleTime = 0 } = this.options
      return staleTime > 0
         ? (Date.now() - this.value.updatedAt) >= staleTime
         : true
   }

   get value() {
      return this.event.state
   }

   get state() {
      return this.event.type
   }

   get isInfinite() {
      return !!this.options.nextPage || !!this.options.previousPage
   }

   get pages() {
      return this.isPreviousData ? this.previousState!.pages : this.value.pages
   }

   get last() {
      return this.pages[this.value.pages.length - 1]
   }

   get first() {
      return this.pages[0]
   }

   get hasNextPage() {
      return !!this.last?.nextPage
   }

   get hasPreviousPage() {
      return !!this.first?.previousPage
   }

   get isPreviousData() {
      return this.previousState !== void 0
   }

   next(event: QueryEvent) {
      if (this.window) {
         this.previousState = event.type === "loading" && !!this.options.keepPreviousData
            ? this.event.state
            : void 0
         if (event.type === "success") {
            this.sub = getInvalidators(this.invalidator, this.options).subscribe(({ force = false } = {}) => {
               this.sub.unsubscribe()
               this.fetchInternal(this.params, {refresh: true, force})
            })
         } else {
            this.sub.unsubscribe()
         }
         this.window = event.type !== "success" && event.type !== "error"
         this.event = event
         this.emitter.next(this)
      }
   }

   connect() {
      if (!this.connections++) {
         queries.add(this)
         this.subscription = this.query.pipe(
            distinctUntilChanged(),
            switchAll(),
         ).subscribe(this)
      }
   }

   disconnect() {
      if (this.connections && !--this.connections) {
         queries.delete(this)
         this.sub.unsubscribe()
         this.subscription.unsubscribe()
      }
   }

   fetch(...queryParams: any[]) {
      this.fetchInternal(queryParams)
      return this
   }

   fetchInternal(queryParams: any[], { refresh = false, force = false } = {}) {
      this.key = this.getQueryKey(queryParams.slice(+this.isInfinite))
      const { fetch, result } = this.createQuery(
         this.key,
         this.store,
         this.options,
      )
      this.params = queryParams
      this.window = true
      if (refresh) {
         result.pipe(take(1)).subscribe(this).unsubscribe()
      } else {
         this.query.next(result)
      }
      if (this.isSettled && this.isStale || force) {
         this.window = true
         fetch.next({ queryFn: this.options.fetch, queryParams, refresh, pages: this.pages, options: this.options })
      }
   }

   fetchNextPage() {
      if (this.hasNextPage) {
         this.fetch(this.last.nextPage, ...this.params.slice(1))
      }
   }

   fetchPreviousPage() {
      if (this.hasPreviousPage) {
         this.fetch(this.first.previousPage, ...this.params.slice(1))
      }
   }

   getQueryKey(params: any[]) {
      const { key, cacheTime = 300_000 } = this.options
      const segments = typeof key === "string" ? [key, ...params] : key(params)
      return stableHash([segments, cacheTime])
   }

   refetch(options: { force?: boolean } = {}) {
      this.invalidator.next(options)
      return this
   }

   constructor(public options: QueryOptions) {
      super((observer) => {
         this.connect()
         observer.add(this.emitter.subscribe(observer))
         observer.add(() => this.disconnect())
         return observer
      })

      this.store = options.store ?? globalStore
      this.createQuery = this.isInfinite ? createInfiniteQuery : createQuery
   }
}

const noop = () => EMPTY

const QueryStore = new InjectionToken<QueryStore>("QueryStore", {
   factory: () => globalStore
})

interface MutationOptions {
   mutate: (...params: any[]) => Observable<any>
}

class MutationClient extends Observable<MutationClient> {
   connections = 0
   mutation = new Subject<Observable<QueryEvent>>()
   emitter = new BehaviorSubject<MutationClient>(this)
   event: QueryEvent = getInitialEvent()
   subscription = Subscription.EMPTY

   get data() {
      return this.value.data
   }

   get isFetching() {
      // todo: implement network mode
      return this.state === "loading"
   }

   get isLoading() {
      return this.state === "loading"
   }

   get isProgress() {
      return this.state === "progress"
   }

   get isSuccess() {
      return this.state === "success"
   }

   get hasError() {
      return this.state === "error"
   }

   get thrownError() {
      return this.value.error
   }

   get isSettled() {
      return this.isSuccess || this.hasError
   }

   get value() {
      return this.event.state
   }

   get state() {
      return this.event.type
   }

   next(event: QueryEvent) {
      this.event = event
      this.emitter.next(this)
   }

   connect() {
      if (!this.connections++) {
         this.subscription = this.mutation.pipe(
            mergeAll()
         ).subscribe(this)
      }
   }

   disconnect() {
      if (this.connections && !--this.connections) {
         this.subscription.unsubscribe()
      }
   }

   mutate(...params: any[]) {
      const result = of({ queryFn: this.options.mutate, queryParams: params }).pipe(
         createResult()
      )
      this.mutation.next(result)
      return this
   }

   reset() {
      this.event = getInitialEvent()
   }

   constructor(public options: MutationOptions) {
      super((subscriber => {
         this.connect()
         subscriber.add(this.emitter.subscribe(subscriber))
         subscriber.add(() => this.disconnect())
      }));
   }
}

describe("Mutation", () => {
   it("should create", () => {
      const mutation = new MutationClient({
         mutate: () => of(0)
      })

      expect(mutation).toBeInstanceOf(MutationClient)
   })

   it("should mutate data", () => {
      const mutation = new MutationClient({
         mutate: () => of(0)
      })
      subscribeSpyTo(mutation)

      mutation.mutate()

      expect(mutation.data).toBe(0)
   })

   it("should have transition states", () => {

   })
})

describe("Query", () => {
   it("should create", () => {
      const query = new QueryClient({
         key: "query",
         fetch: noop,
      })

      expect(query).toBeInstanceOf(QueryClient)
   })

   it("should fetch data", () => {
      const expected = 0
      const query = new QueryClient({
         key: "query",
         fetch: (value: number) => of(value + 1),
      })

      const result = subscribeSpyTo(query.fetch(expected))

      expect(result.getLastValue()).toBe(query)
   })

   it("should emit the current value on subscribe", () => {
      const query = new QueryClient({
         key: "query",
         fetch: noop,
      })

      const result = subscribeSpyTo(query)

      expect(result.getFirstValue()).toBe(query)
      expect(result.getValuesLength()).toBe(1)
   })

   it("should unsubscribe from the source when there are no more observers", () => {
      const spy = createSpy()
      const query = new QueryClient({
         key: "query",
         fetch: () => interval(0).pipe(tap({ unsubscribe: spy })),
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
         { type: "loading" },
         { type: "progress", value: 0 },
         { type: "progress", value: 1 },
         { type: "progress", value: 2 },
         { type: "success" }
      ]
      const query = new QueryClient({
         key: "query",
         fetch: () => interval(1000).pipe(take(3)),
      })
      const result = subscribeSpyTo(query.pipe(map(q => q.event)))

      subscribeSpyTo(query.fetch())
      tick(3000)

      expect(result.getValues()).toEqual(arrayContaining(expectedEvents))
   }))

   it("should return initial state", () => {
      const query = new QueryClient({
         key: "query",
         fetch: noop,
      })

      const result = query.value

      expect(result).toBe(INITIAL_STATE)
   })

   it("should sync queries by their query key", fakeAsync(() => {
      const fetch = () => interval(1000).pipe(take(3))
      const query = new QueryClient({
         key: "todos",
         fetch,
      })
      const query2 = new QueryClient({
         key: "todos",
         fetch,
      })

      subscribeSpyTo(query.fetch())
      subscribeSpyTo(query2.fetch())
      tick(1000)

      expect(query.value.data).toBe(0)
      expect(query2.value.data).toBe(query.value.data)

      tick(1000)

      expect(query.value.data).toBe(1)
      expect(query2.value).toBe(query.value)

      tick(1000)

      expect(query.value.data).toBe(2)
      expect(query2.value).toBe(query.value)
   }))

   it("should dedupe new fetch when an existing fetch is in flight", fakeAsync(() => {
      const spy = createSpy()
      const fetch = () => interval(1000).pipe(tap({ subscribe: spy }), take(1))
      const query = new QueryClient({
         key: "todos",
         fetch,
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
      const fetch = () => timer(1000).pipe(tap({ subscribe: spy }))
      const query = new QueryClient({
         key: "todos",
         fetch,
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
      const fetch = (page: number) => {
         return of({
            data: { page },
            nextCursor: page + 1
         })
      }
      const query = new QueryClient({
         key: "todos",
         fetch,
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

   it("should fetch previous and next pages", () => {
      let cursor = 0
      const expectedPages = [
         { data: { page: -2 }, nextPage: -1, previousPage: -3 },
         { data: { page: -1 }, nextPage: 0, previousPage: -2 },
         { data: { page: 0 }, nextPage: 1, previousPage: -1 },
         { data: { page: 1 }, nextPage: 2, previousPage: 0 },
         { data: { page: 2 }, nextPage: 3, previousPage: 1 },
      ]
      const fetch = (page: number) => {
         return of({
            data: { page },
            nextCursor: page + 1,
            previousCursor: page - 1
         })
      }
      const query = new QueryClient({
         key: "todos",
         fetch,
         nextPage: result => result.nextCursor,
         previousPage: result => result.previousCursor,
         select: result => result.data
      })

      subscribeSpyTo(query.fetch(cursor))

      query.fetchNextPage()
      query.fetchPreviousPage()
      query.fetchNextPage()
      query.fetchPreviousPage()

      expect(query.pages).toEqual(arrayContaining(expectedPages))

      query.refetch()

      expect(query.pages).toEqual(arrayContaining(expectedPages))
   })

   it("should refresh infinite query", () => {
      let cursor = 0
      const fetch = (page: number) => {
         return of({
            data: { page },
            nextCursor: ++cursor
         })
      }
      const query = new QueryClient({
         key: "todos",
         fetch,
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
      const query = new QueryClient({
         key: "todos",
         fetch: () => of(0).pipe(tap({ subscribe: spy })),
      })

      subscribeSpyTo(query.fetch())

      expect(spy).toHaveBeenCalledTimes(1)

      query.refetch()

      expect(spy).toHaveBeenCalledTimes(2)
   })

   it("should keep previous data", fakeAsync(() => {
      const query = new QueryClient({
         key: "todos",
         fetch: (value: number) => of(value).pipe(delay(1000)),
         keepPreviousData: true
      })

      subscribeSpyTo(query.fetch(1))
      tick(1000)

      expect(query.data).toBe(1)

      query.fetch(2)

      expect(query.isPreviousData).toBeTrue()
      expect(query.data).withContext('previous data').toBe(1)

      tick(1000)
      expect(query.isPreviousData).toBeFalse()
      expect(query.data).toBe(2)
   }))

   it("should clear cache when there are no observers after a period of time", fakeAsync(() => {
      let subscription
      const fetch = (value: number) => of(value).pipe(delay(1000))
      const query = new QueryClient({
         key: "todos",
         fetch,
         cacheTime: 10000
      })

      subscription = subscribeSpyTo(query.fetch(10))

      expect(query.value.data).toBe(null)

      tick(1000)

      expect(query.value.data).toBe(10)
      subscription.unsubscribe()

      tick(10000)

      subscribeSpyTo(query.fetch(10))

      expect(query.value.data).toBe(null)
      discardPeriodicTasks()
   }))

   it("should fetch independently of other queries with the same query key", fakeAsync(() => {
      let count = 0
      const fetch = () => {
         return from([count++, count++, count++]).pipe(map((value) => of(value).pipe(delay(1000))), concatAll())
      }
      const query = new QueryClient({
         key: "todos",
         fetch,
         refreshInterval: 10000
      })
      const query2 = new QueryClient({
         key: "todos",
         fetch,
         refreshInterval: 39000
      })

      subscribeSpyTo(query)
      subscribeSpyTo(query2)

      query.fetch()
      query2.fetch()

      tick(3000)

      expect(query.value.data).toBe(2)
      expect(query2.value.data).toBe(2)

      tick(13000)

      expect(query.value.data).toBe(5)
      expect(query2.value.data).toBe(2)

      tick(13000)

      expect(query.value.data).toBe(8)
      expect(query2.value.data).toBe(2)

      tick(13000)

      expect(query.value.data).toBe(11)
      expect(query2.value.data).toBe(11)

      tick(13000)

      expect(query.value.data).toBe(14)
      expect(query2.value.data).toBe(11)

      discardPeriodicTasks()
   }))

   it("should synchronize refresh timers", fakeAsync(() => {
      let count = 0
      const fetch = () => of(count++)
      const query = new QueryClient({
         key: "todos",
         fetch,
         refreshInterval: 1000
      })

      const query2 = new QueryClient({
         key: "todos2",
         fetch,
         refreshInterval: 1000
      })

      subscribeSpyTo(query.fetch())
      tick(500)
      subscribeSpyTo(query2.fetch())

      expect(query.value.data).toBe(0)
      expect(query2.value.data).toBe(1)

      tick(500)

      expect(query.value.data).toBe(2)
      expect(query2.value.data).toBe(3)

      tick(500)

      expect(query.value.data).toBe(2)
      expect(query2.value.data).toBe(3)

      tick(500)

      expect(query.value.data).toBe(4)
      expect(query2.value.data).toBe(5)

      discardPeriodicTasks()
   }))

   it("should not have pages", () => {
      const query = new QueryClient({
         key: "todos",
         fetch: () => of(1)
      })

      subscribeSpyTo(query.fetch())

      expect(query.hasPreviousPage).toBe(false)
      expect(query.hasNextPage).toBe(false)
      expect(query.pages).toEqual([])
   })

   it("should have transition states", fakeAsync(() => {
      const query = new QueryClient({
         key: "todos",
         fetch: () => interval(1000).pipe(take(3))
      })

      expect(query.isSettled).toBeTrue()
      expect(query.isInitial).toBeTrue()
      expect(query.isRefetching).toBeFalse()
      expect(query.isLoading).toBeFalse()
      expect(query.isFetching).toBeFalse()
      expect(query.isInitialLoading).toBeFalse()
      expect(query.isProgress).toBeFalse()
      expect(query.isSuccess).toBeFalse()

      subscribeSpyTo(query.fetch())

      expect(query.isSettled).toBeFalse()
      expect(query.isInitial).toBeFalse()
      expect(query.isRefetching).toBeFalse()
      expect(query.isFetching).toBeTrue()
      expect(query.isInitialLoading).toBeTrue()
      expect(query.isProgress).toBeFalse()
      expect(query.isSuccess).toBeFalse()

      tick(1000)

      expect(query.isSettled).toBeFalse()
      expect(query.isInitial).toBeFalse()
      expect(query.isFetching).toBeFalse()
      expect(query.isLoading).toBeFalse()
      expect(query.isRefetching).toBeFalse()
      expect(query.isInitialLoading).toBeFalse()
      expect(query.isProgress).toBeTrue()
      expect(query.isSuccess).toBeFalse()

      tick(2000)

      expect(query.isSettled).toBeTrue()
      expect(query.isInitial).toBeFalse()
      expect(query.isFetching).toBeFalse()
      expect(query.isLoading).toBeFalse()
      expect(query.isRefetching).toBeFalse()
      expect(query.isInitialLoading).toBeFalse()
      expect(query.isProgress).toBeFalse()
      expect(query.isSuccess).toBeTrue()

      query.fetch()

      expect(query.isFetching).toBeTrue()
      expect(query.isLoading).toBeTrue()
      expect(query.isRefetching).toBeTrue()
      expect(query.isInitialLoading).toBeFalse()

      discardPeriodicTasks()
   }))

   it("should have error state", () => {
      const query = new QueryClient({
         key: "todos",
         fetch: () => throwError(() => new Error("BOGUS"))
      })

      subscribeSpyTo(query.fetch())

      expect(query.hasError).toBeTrue()
      expect(query.thrownError).toEqual(new Error("BOGUS"))
   })

   it("should continue after errors", () => {
      const query = new QueryClient({
         key: "todos",
         fetch: (shouldThrow: boolean) => shouldThrow ? throwError(() => new Error("BOGUS")) : of(0)
      })

      subscribeSpyTo(query.fetch(true))

      expect(query.hasError).toBeTrue()
      expect(query.thrownError).toEqual(new Error("BOGUS"))

      query.fetch(false)

      expect(query.hasError).toBeFalse()
      expect(query.thrownError).toBeNull()
      expect(query.isSuccess).toBeTrue()
      expect(query.data).toBe(0)
   })

   it("should invalidate queries", () => {
      const spy = createSpy()
      const spy2 = createSpy()
      const query = new QueryClient({
         key: "todos",
         fetch: (value: number) => of(value).pipe(tap({ subscribe: spy }))
      })
      const query2 = new QueryClient({
         key: "todos",
         fetch: (value: number) => of(value).pipe(tap({ subscribe: spy2 }))
      })

      subscribeSpyTo(query.fetch(1))
      subscribeSpyTo(query2.fetch(2))

      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy2).toHaveBeenCalledTimes(1)

      invalidateQueries({ params: [2] })

      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy2).toHaveBeenCalledTimes(2)

      invalidateQueries()

      expect(spy).toHaveBeenCalledTimes(2)
      expect(spy2).toHaveBeenCalledTimes(3)
   })

   it("should refresh stale query", fakeAsync(() => {
      const spy = createSpy()
      const query = new QueryClient({
         key: "todos",
         fetch: (value: number) => of(value).pipe(tap({ subscribe: spy })),
         staleTime: 10000,
         refreshInterval: 5000,
      })

      subscribeSpyTo(query.fetch())

      expect(spy).toHaveBeenCalledTimes(1)

      tick(5000)

      expect(spy).toHaveBeenCalledTimes(1)

      tick(5000)

      expect(spy).toHaveBeenCalledTimes(2)

      discardPeriodicTasks()
   }))

   it("should force refresh query", () => {
      const spy = createSpy()
      const query = new QueryClient({
         key: "todos",
         fetch: (value: number) => of(value).pipe(tap({ subscribe: spy })),
         staleTime: 10000,
      })

      subscribeSpyTo(query.fetch())

      expect(spy).toHaveBeenCalledTimes(1)

      query.refetch({ force: true })

      expect(spy).toHaveBeenCalledTimes(2)
   })
})
