import {runTestInAction} from "../test/test-utils";
import {loadEffect} from "./load-effect";
import {Observable, of} from "rxjs";
import {dispatch} from "./create-dispatch";
import {fakeAsync, flushMicrotasks, TestBed} from "@angular/core/testing";
import {EffectScheduler} from "./core";
import createSpy = jasmine.createSpy;
import {ErrorHandler} from "@angular/core";

async function fakeImport(effect: (...args: any) => Observable<any>) {
   return {
      default: effect
   }
}

describe("loadEffect", () => {
   it("should lazy load effects", runTestInAction(fakeAsync(() => {
      const next = createSpy()
      const scheduler = TestBed.inject(EffectScheduler)
      const returnInput = loadEffect(() => fakeImport((value) => of(value)))

      dispatch(returnInput(1337), next)
      flushMicrotasks()
      scheduler.dequeue()

      expect(next).toHaveBeenCalledOnceWith(1337)
   })))

   it("should catch load errors", runTestInAction(fakeAsync(() => {
      const scheduler = TestBed.inject(EffectScheduler)
      const errorHandler = TestBed.inject(ErrorHandler)
      spyOn(errorHandler, "handleError").and.callThrough()
      const throwInput = loadEffect(() => {
         throw new Error("BOGUS")
      })

      dispatch(throwInput())
      flushMicrotasks()
      scheduler.dequeue()

      expect(errorHandler.handleError).toHaveBeenCalledOnceWith(new Error("BOGUS"))
   })))

   it("should catch effect creation errors", runTestInAction(fakeAsync(() => {
      const scheduler = TestBed.inject(EffectScheduler)
      const errorHandler = TestBed.inject(ErrorHandler)
      const throwInput = loadEffect(() => fakeImport((value) => {
         throw value
      }))
      spyOn(errorHandler, "handleError").and.callThrough()

      dispatch(throwInput(new Error("BOGUS")))
      flushMicrotasks()
      scheduler.dequeue()

      expect(errorHandler.handleError).toHaveBeenCalledOnceWith(new Error("BOGUS"))
   })))
})
