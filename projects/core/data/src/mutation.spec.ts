import {INJECTOR} from "@angular/core";
import {from, interval, of, take, tap, throwError} from "rxjs";
import {subscribeSpyTo} from "@hirez_io/observer-spy";
import {fakeAsync, TestBed, tick} from "@angular/core/testing";
import {MutationClient} from "./mutation";
import createSpy = jasmine.createSpy;
import objectContaining = jasmine.objectContaining;
import {QueryClient} from "./query";

describe("Mutation", () => {
   it("should create", () => {
      const mutation = new MutationClient({
         mutate: () => of(0),
         injector: TestBed.inject(INJECTOR)
      })

      expect(mutation).toBeInstanceOf(MutationClient)
   })

   it("should mutate data", () => {
      const mutation = new MutationClient({
         mutate: () => of(0),
         injector: TestBed.inject(INJECTOR)
      })
      subscribeSpyTo(mutation)

      mutation.mutate()

      expect(mutation.data).toBe(0)
   })

   it("should have transition states", fakeAsync(() => {
      const mutation = new MutationClient({
         mutate: () => interval(1000).pipe(take(3)),
         injector: TestBed.inject(INJECTOR)
      })

      expect(mutation.isSettled).toBeTrue()
      expect(mutation.isLoading).toBeFalse()
      expect(mutation.isFetching).toBeFalse()
      expect(mutation.isProgress).toBeFalse()
      expect(mutation.isSuccess).toBeFalse()

      mutation.connect()
      mutation.mutate()

      expect(mutation.isSettled).toBeFalse()
      expect(mutation.isFetching).toBeTrue()
      expect(mutation.isProgress).toBeFalse()
      expect(mutation.isSuccess).toBeFalse()

      tick(1000)

      expect(mutation.isSettled).toBeFalse()
      expect(mutation.isFetching).toBeFalse()
      expect(mutation.isLoading).toBeFalse()
      expect(mutation.isProgress).toBeTrue()
      expect(mutation.isSuccess).toBeFalse()

      tick(2000)

      expect(mutation.isSettled).toBeTrue()
      expect(mutation.isFetching).toBeFalse()
      expect(mutation.isLoading).toBeFalse()
      expect(mutation.isProgress).toBeFalse()
      expect(mutation.isSuccess).toBeTrue()

      mutation.disconnect()
   }))

   it("should return the mutation result", () => {
      let result
      const spy = createSpy()
      const mutation = new MutationClient({
         mutate: () => from([0, 1, 2]).pipe(tap({ subscribe: spy })),
         injector: TestBed.inject(INJECTOR)
      })

      mutation.connect()
      result = subscribeSpyTo(mutation.mutate())

      expect(spy).toHaveBeenCalledTimes(1)
      expect(result.getValues()).toEqual([0, 1, 2])

      mutation.disconnect()
   })

   it("should invalidate queries", () => {
      let count = 0
      const spy = createSpy()
      const query = new QueryClient({
         key: "todos",
         fetch: () => of(count++).pipe(tap({ subscribe: spy })),
         injector: TestBed.inject(INJECTOR)
      })
      const mutation = new MutationClient({
         mutate: () => of(0),
         onSettled: () => {
            query.refetch()
         },
         injector: TestBed.inject(INJECTOR)
      })

      query.connect()
      mutation.connect()

      query.fetch()
      mutation.mutate()

      expect(spy).toHaveBeenCalledTimes(2)
      expect(query.data).toBe(1)

      query.disconnect()
      mutation.disconnect()
   })

   it("should call error handler", () => {
      const onError = createSpy()
      const onSettled = createSpy()
      const mutation = new MutationClient({
         mutate: () => throwError(() => new Error("BOGUS")),
         onError,
         onSettled,
         injector: TestBed.inject(INJECTOR)
      })

      mutation.connect()

      mutation.mutate()

      expect(onError).toHaveBeenCalledOnceWith(objectContaining({ error: new Error("BOGUS") }))
      expect(onSettled).toHaveBeenCalledOnceWith(objectContaining({ error: new Error("BOGUS") }))

      mutation.disconnect()
   })

   it("should call side effects", () => {
      const value = 10
      const onMutate = createSpy()
      const onProgress = createSpy()
      const onSuccess = createSpy()
      const onSettled = createSpy()
      const mutation = new MutationClient({
         mutate: (value: number) => from([value + 1, value + 2, value + 3]),
         onMutate: (context) => onMutate({...context}),
         onProgress: (context) => onProgress({...context}),
         onSuccess: (context) => onSuccess({...context}),
         onSettled: (context) => onSettled({...context}),
         injector: TestBed.inject(INJECTOR)
      })

      mutation.connect()

      mutation.mutate(value)

      expect(onMutate).toHaveBeenCalledOnceWith({ error: null, params: [value], value: void 0, values: [], invalidateQueries: jasmine.any(Function) })
      expect(onProgress).toHaveBeenCalledWith({ error: null, params: [value], value: value + 1, values: [value + 1], invalidateQueries: jasmine.any(Function) })
      expect(onProgress).toHaveBeenCalledWith({ error: null, params: [value], value: value + 2, values: [value + 1, value + 2], invalidateQueries: jasmine.any(Function) })
      expect(onProgress).toHaveBeenCalledWith({ error: null, params: [value], value: value + 3, values: [value + 1, value + 2, value + 3], invalidateQueries: jasmine.any(Function) })
      expect(onSuccess).toHaveBeenCalledOnceWith({ error: null, params: [value], value: value + 3, values: [value + 1, value + 2, value + 3], invalidateQueries: jasmine.any(Function) })
      expect(onSettled).toHaveBeenCalledOnceWith({ error: null, params: [value], value: value + 3, values: [value + 1, value + 2, value + 3], invalidateQueries: jasmine.any(Function) })

      mutation.disconnect()
   })

   it("should count errors", () => {
      const mutation = new MutationClient({
         mutate: (shouldThrow: boolean) => shouldThrow ? throwError(() => new Error("BOGUS")) : of(0),
         injector: TestBed.inject(INJECTOR)
      })

      mutation.connect()

      mutation.mutate(true)

      expect(mutation.failureCount).toBe(1)

      mutation.mutate(true)
      mutation.mutate(true)

      expect(mutation.failureCount).toBe(3)

      mutation.mutate(false)

      expect(mutation.failureCount).toBe(0)

      mutation.disconnect()
   })
})
