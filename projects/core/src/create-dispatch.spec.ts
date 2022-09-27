import {dispatch} from "./create-dispatch";
import {Observable, of} from "rxjs";
import {fakeAsync, TestBed} from "@angular/core/testing";
import {EffectScheduler} from "./core";
import {runTestInAction} from "../test/test-utils";
import createSpy = jasmine.createSpy;

describe("dispatch", () => {
   it("should throw when called outside action", () => {
      expect(() => dispatch(of(1337))).toThrow()
   })

   it("should not throw when called inside action", runTestInAction(() => {
      expect(() => dispatch(of(1337))).not.toThrow()
   }))

   it("should dispatch effects", runTestInAction(() => {
      const scheduler = TestBed.inject(EffectScheduler)

      dispatch(of(1337))

      expect(scheduler.queue).toHaveSize(1)
   }))

   it("should return an observable", fakeAsync(runTestInAction(() => {
      const next = createSpy("next")
      const error = createSpy("error")
      const complete = createSpy("complete")
      const scheduler = TestBed.inject(EffectScheduler)

      const result = dispatch(of(1337))
      const subscription = result.subscribe({
         next,
         complete
      })

      expect(result).withContext("The observable mirrors the dispatched effect").toBeInstanceOf(Observable)
      expect(next).withContext("Subscribing to the returned observable does not trigger the effect").toHaveBeenCalledTimes(0)

      scheduler.dequeue()

      expect(next).withContext("The observable mirrors values emitted by the dispatched effect").toHaveBeenCalledOnceWith(1337)
      expect(subscription.closed).withContext("The subscription is closed when the dispatched effect completes").toBeTrue()
      expect(complete).withContext("The observer receives the complete event").toHaveBeenCalledTimes(1)

      dispatch(of(1337))
      scheduler.dequeue()

      expect(next).withContext("The returned observable does not mirror future effects").toHaveBeenCalledTimes(1)

      const result2 = new Observable(() => {
         throw new Error("BOGUS")
      })
      const subscription2 = result2.subscribe({
         next,
         error
      })

      dispatch(result2)
      scheduler.dequeue()

      expect(subscription2.closed).withContext("The subscription is closed when the dispatched effect errors").toBeTrue()
      expect(error).withContext("The observer receives the error event").toHaveBeenCalledTimes(1)

      const result3 = dispatch(of(1337))
      result3.subscribe({
         next,
         complete
      })
      scheduler.dequeue()

      expect(next).withContext("Should continue dispatching effects after error").toHaveBeenCalledTimes(2)
      expect(complete).withContext("Should continue dispatching effects after error").toHaveBeenCalledTimes(2)
   })))
})
