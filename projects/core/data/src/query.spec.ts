import {concatAll, delay, from, interval, map, of, take, tap, throwError, timer} from "rxjs";
import {subscribeSpyTo} from "@hirez_io/observer-spy";
import {discardPeriodicTasks, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {arrayContaining} from "../../src/tests/utils/event-matcher";
import createSpy = jasmine.createSpy;
import {INITIAL_STATE, noop} from "./utils";
import {invalidateQueries, QueryClient} from "./query";
import {EnvironmentInjector, INJECTOR} from "@angular/core";
import { QUERY_CONFIG } from "./providers";

describe("Query", () => {
   it("should create", () => {
      const query = new QueryClient({
         key: "query",
         fetch: noop,
         injector: TestBed.inject(INJECTOR)
      })

      expect(query).toBeInstanceOf(QueryClient)
   })

   it("should fetch data", () => {
      const expected = 0
      const query = new QueryClient({
         key: "query",
         fetch: (value: number) => of(value + 1),
         injector: TestBed.inject(INJECTOR)
      })

      const result = subscribeSpyTo(query.fetch(expected))

      expect(result.getLastValue()).toBe(query)
   })

   it("should emit the current value after first fetch", () => {
      const query = new QueryClient({
         key: "query",
         fetch: noop,
         injector: TestBed.inject(INJECTOR)
      })

      const result = subscribeSpyTo(query)

      expect(result.receivedNext()).toBeFalse()

      query.fetch()

      expect(result.getFirstValue()).toBe(query)
   })

   it("should unsubscribe from the source when there are no more observers", () => {
      const spy = createSpy()
      const query = new QueryClient({
         key: "query",
         fetch: () => interval(0).pipe(tap({ unsubscribe: spy })),
         cacheTime: 0,
         injector: TestBed.inject(INJECTOR)
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
         injector: TestBed.inject(INJECTOR)
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
         injector: TestBed.inject(INJECTOR)
      })

      const result = query.value

      expect(result).toBe(INITIAL_STATE)
   })

   it("should sync queries by their query key", fakeAsync(() => {
      const fetch = () => interval(1000).pipe(take(3))
      const query = new QueryClient({
         key: "todos",
         fetch,
         injector: TestBed.inject(INJECTOR)
      })
      const query2 = new QueryClient({
         key: "todos",
         fetch,
         injector: TestBed.inject(INJECTOR)
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
         injector: TestBed.inject(INJECTOR)
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
         injector: TestBed.inject(INJECTOR)
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
         select: result => result.data,
         injector: TestBed.inject(INJECTOR)
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
         select: result => result.data,
         injector: TestBed.inject(INJECTOR)
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
         select: result => result.data,
         injector: TestBed.inject(INJECTOR)
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
         injector: TestBed.inject(INJECTOR)
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
         keepPreviousData: true,
         injector: TestBed.inject(INJECTOR),
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

      query.fetch(3)
      tick(1000)

      expect(query.data).toBe(3)

      discardPeriodicTasks()
   }))

   it("should clear cache when there are no observers after a period of time", fakeAsync(() => {
      let subscription
      const fetch = (value: number) => of(value).pipe(delay(1000))
      const query = new QueryClient({
         key: "todos",
         fetch,
         cacheTime: 10000,
         injector: TestBed.inject(INJECTOR)
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
         refreshInterval: 10000,
         injector: TestBed.inject(INJECTOR)
      })
      const query2 = new QueryClient({
         key: "todos",
         fetch,
         refreshInterval: 39000,
         injector: TestBed.inject(INJECTOR)
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
         refreshInterval: 1000,
         injector: TestBed.inject(INJECTOR)
      })

      const query2 = new QueryClient({
         key: "todos2",
         fetch,
         refreshInterval: 1000,
         injector: TestBed.inject(INJECTOR)
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
         fetch: () => of(1),
         injector: TestBed.inject(INJECTOR)
      })

      subscribeSpyTo(query.fetch())

      expect(query.hasPreviousPage).toBe(false)
      expect(query.hasNextPage).toBe(false)
      expect(query.pages).toEqual([])
   })

   it("should have transition states", fakeAsync(() => {
      const query = new QueryClient({
         key: "todos",
         fetch: () => interval(1000).pipe(take(3)),
         injector: TestBed.inject(INJECTOR)
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
         fetch: () => throwError(() => new Error("BOGUS")),
         injector: TestBed.inject(INJECTOR)
      })

      subscribeSpyTo(query.fetch())

      expect(query.hasError).toBeTrue()
      expect(query.thrownError).toEqual(new Error("BOGUS"))
   })

   it("should continue after errors", () => {
      const query = new QueryClient({
         key: "todos",
         fetch: (shouldThrow: boolean) => shouldThrow ? throwError(() => new Error("BOGUS")) : of(0),
         injector: TestBed.inject(INJECTOR)
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
         fetch: (value: number) => of(value).pipe(tap({ subscribe: spy })),
         injector: TestBed.inject(INJECTOR)
      })
      const query2 = new QueryClient({
         key: "todos",
         fetch: (value: number) => of(value).pipe(tap({ subscribe: spy2 })),
         injector: TestBed.inject(INJECTOR)
      })
      const { clients } = TestBed.inject(INJECTOR).get(QUERY_CONFIG)

      subscribeSpyTo(query.fetch(1))
      subscribeSpyTo(query2.fetch(2))

      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy2).toHaveBeenCalledTimes(1)

      invalidateQueries(clients, { params: [2] })

      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy2).toHaveBeenCalledTimes(2)

      invalidateQueries(clients)

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
         injector: TestBed.inject(INJECTOR)
      })

      subscribeSpyTo(query.fetch(10))

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
         injector: TestBed.inject(INJECTOR)
      })

      subscribeSpyTo(query.fetch(10))

      expect(spy).toHaveBeenCalledTimes(1)

      query.refetch({ force: true })

      expect(spy).toHaveBeenCalledTimes(2)
   })

   it("should manually set query data",() => {
      const expected = 10
      const query = new QueryClient({
         key: "todos",
         fetch: (value: number) => of(0),
         injector: TestBed.inject(INJECTOR)
      })

      query.connect()

      query.setValue({ data: expected })

      expect(query.data).toBe(expected)

      query.disconnect()
   })

   it("should count errors", () => {
      const query = new QueryClient({
         key: "todos",
         fetch: (shouldThrow: boolean) => shouldThrow ? throwError(() => new Error("BOGUS")) : of(0),
         injector: TestBed.inject(INJECTOR)
      })

      query.connect()

      query.fetch(true)

      expect(query.failureCount).toBe(1)

      query.fetch(true)

      query.fetch(true)

      expect(query.failureCount).toBe(3)

      query.fetch(false)

      expect(query.failureCount).toBe(0)

      query.disconnect()
   })
})
