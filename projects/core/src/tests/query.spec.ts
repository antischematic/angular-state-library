import {inject, InjectionToken} from "@angular/core";
import {fakeAsync, TestBed, tick} from "@angular/core/testing";
import {subscribeSpyTo} from "@hirez_io/observer-spy";
import {
   BehaviorSubject, EMPTY,
   interval, map, materialize,
   Observable,
   of,
   ReplaySubject, share, startWith, Subject,
   Subscription,
   switchAll, take, tap, withLatestFrom
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
}

const INITIAL_STATE: QueryState = {
   isFetching: false,
   isProgress: false,
   isSuccess: false,
   data: null,
   hasError: false,
   error: null,
}

const INITIAL_EVENT: InitialEvent = {
   type: "initial",
   state: INITIAL_STATE
}

interface FetchEvent {
   readonly type: "fetch"
   readonly queryKey: string
   readonly state: QueryState
}

interface SuccessEvent {
   readonly type: "success"
   readonly queryKey: string
   readonly state: QueryState
}

interface ProgressEvent {
   readonly type: "progress"
   readonly queryKey: string
   readonly state: QueryState
}

interface ErrorEvent {
   readonly type: "error"
   readonly queryKey: string
   readonly state: QueryState
}

interface InitialEvent {
   readonly type: "initial"
   readonly state: QueryState
}

type QueryEvent =
   | InitialEvent
   | FetchEvent
   | SuccessEvent
   | ProgressEvent
   | ErrorEvent

function createQuery(query: QueryClient, queryKey: string, source: Observable<any>, store: QueryStore) {
   const cache = store.get(queryKey)
   if (cache) {
      return cache
   }
   const result = source.pipe(
      materialize(),
      startWith({ kind: "F" } as const),
      map((event) => {
         const { state } = query
         switch (event.kind) {
            case "F": {
               return {
                  type: "fetch",
                  key: queryKey,
                  state: { ...state, isFetching: true, isProgress: false, isSuccess: false, hasError: false, error: null, state: "fetch" }
               }
            }
            case "N": {
               return {
                  type: "progress",
                  key: queryKey,
                  value: event.value,
                  state: { ...state, isProgress: true, data: event.value, state: "progress" }
               }
            }
            case "E": {
               return {
                  type: "error",
                  key: queryKey,
                  error: event.error,
                  state: { ...state, isFetching: false, isProgress: false, isSuccess: false, hasError: true, error: event.error, state: "error" }
               }
            }
            case "C": {
               return {
                  type: "success",
                  key: queryKey,
                  state: { ...state, isFetching: false, isProgress: false, isSuccess: true, hasError: false, error: null, state: "success" }
               }
            }
         }
         return state
      }),
      share({
         connector: () => new ReplaySubject(1),
         resetOnRefCountZero: true
      })
   )
   store.set(queryKey, result)
   return result
}

interface QueryStore extends Map<string, any> {}

interface QueryOptions {
   key: string | ((params: any[]) => unknown[])
   fetch: (...params: any[]) => Observable<unknown>
   store?: QueryStore
}

class QueryClient extends Observable<any> {
   params: any
   query = new ReplaySubject<Observable<any>>(1)
   connections = 0
   emitter = new BehaviorSubject(this)
   subscription = Subscription.EMPTY
   store: QueryStore
   event: QueryEvent = INITIAL_EVENT

   get state() {
      return this.event.state
   }

   get value() {
      return this.state
   }

   next(event: QueryEvent) {
      this.event = event
      this.emitter.next(this)
   }

   connect() {
      if (!this.connections++) {
         this.subscription = this.query.pipe(switchAll()).subscribe(this)
      }
   }

   disconnect() {
      if (!--this.connections) {
         this.subscription.unsubscribe()
      }
   }

   fetch(...params: any[]) {
      this.params = params
      this.query.next(createQuery(this, this.getQueryKey(params), this.options.fetch(...params), this.store))
      return this
   }

   getQueryKey(params: any[]) {
      const { key } = this.options
      return JSON.stringify(typeof key === "string" ? [key, ...params] : key(params))
   }

   constructor(private options: QueryOptions) {
      super((observer) => {
         this.connect()
         observer.add(this.emitter.subscribe(observer))
         observer.add(() => this.disconnect())
         return observer
      })

      this.store = options.store ?? inject(QueryStore)
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
         store
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
      expect(store.size).toBe(1)

      tick(1000)

      expect(query.state.data).toBe(1)
      expect(query2.state).toBe(query.state)

      tick(1000)

      expect(query.state.data).toBe(2)
      expect(query2.state).toBe(query.state)
   }))

   it("should dedupe new fetch when an existing fetch is in flight", () => {

   })
})
