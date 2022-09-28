import {
   Action,
   dispatch,
   EVENTS,
   Store,
   Invoke,
   Select
} from "@antischematic/angular-state-library";
import {ApplicationRef, Component, ElementRef, inject, Type} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {concat, finalize, from, NEVER, Observable, of, throwError} from "rxjs";
import {subscribeSpyTo} from "@hirez_io/observer-spy";
import createSpy = jasmine.createSpy;
import Spy = jasmine.Spy;
import objectContaining = jasmine.objectContaining;

function createComponent<T>(type: Type<T>): ComponentFixture<T> {
   return TestBed.configureTestingModule({ declarations: [type] }).createComponent(type)
}

describe("Core", () => {
   describe("Action", () => {
      @Store()
      @Component({ template: `` })
      class UITest {
         @Action() returnArguments(...args: any[]) {
            return args
         }

         @Action() injectDependencies(...types: any[]) {
            return types.map(type => inject(type))
         }

         @Action() dispatchEffects(...effects: Observable<any>[]) {
            return concat(...effects.map((effect) => dispatch(effect)))
         }

         @Action() cleanupOnDestroy(spy: Spy) {
            return dispatch(NEVER.pipe(finalize(spy)))
         }
      }

      it("should behave like a normal function", () => {
         const fixture = createComponent(UITest)

         const result = fixture.componentInstance.returnArguments(1, 2, 3)

         expect(result).toEqual([1, 2, 3])
      })

      it("should be injectable", () => {
         const fixture = createComponent(UITest)

         const [element, app] = fixture.componentInstance.injectDependencies(ElementRef, ApplicationRef)

         expect(element).toBeInstanceOf(ElementRef)
         expect(app).toBeInstanceOf(ApplicationRef)
      })

      it("should dispatch effects", () => {
         spyOn(console, "error")
         const fixture = createComponent(UITest)
         const result = fixture.componentInstance.dispatchEffects(of(1), from([10, 20, 30]), throwError(() => new Error("BOGUS")))
         const observerSpy = subscribeSpyTo(result, { expectErrors: true });

         expect(observerSpy.receivedNext()).toBeFalse()
         expect(observerSpy.receivedError()).toBeFalse()
         expect(observerSpy.receivedComplete()).toBeFalse()

         fixture.detectChanges()

         expect(observerSpy.getValues()).toEqual([1, 10, 20, 30])
         expect(observerSpy.getError()).toEqual(new Error("BOGUS"))
         expect(console.error).toHaveBeenCalledOnceWith("ERROR", new Error("BOGUS"))
      })

      it("should cleanup effects on destroy", () => {
         const spy = createSpy()
         const fixture = createComponent(UITest)
         const result = fixture.componentInstance.cleanupOnDestroy(spy)
         const observerSpy = subscribeSpyTo(result)

         fixture.detectChanges()
         fixture.destroy()

         expect(spy).toHaveBeenCalledTimes(1)
         expect(observerSpy.receivedComplete()).toBeTrue()
      })
   })

   describe("Invoke", () => {
      it("should be called on first change detection cycle", () => {
         @Store()
         @Component({ template: `` })
         class UITest {
            @Invoke() iAmCalledOnce() {}
         }
         const fixture = createComponent(UITest)
         const spy = subscribeSpyTo(TestBed.inject(EVENTS))

         fixture.detectChanges()

         expect(spy.getValueAt(0)).toEqual(objectContaining({ name: "iAmCalledOnce" }))
      })

      it("should not be called automatically when function has required arguments", () => {
         @Store()
         @Component({ template: `` })
         class UITest {
            count = 0
            @Invoke() iHaveFunctionArguments(_arg: string) {
               void this.count
            }
         }
         const fixture = createComponent(UITest)
         const spy = subscribeSpyTo(TestBed.inject(EVENTS))

         fixture.detectChanges()
         expect(spy.getValuesLength()).withContext("after first change detection").toBe(0)

         fixture.componentInstance.iHaveFunctionArguments("BOGUS")
         fixture.detectChanges()
         expect(spy.getValuesLength()).withContext("after imperative call").toBe(1)

         fixture.componentInstance.count = 10
         fixture.detectChanges()
         expect(spy.getValuesLength()).withContext("after reactive dependencies change").toBe(1)
      })

      it("should be called each time `this` dependencies change", () => {
         @Store()
         @Component({ template: `` })
         class UITest {
            count = 0
            @Invoke() iAmReactive() {
               void this.count
            }
         }
         const fixture = createComponent(UITest)
         const spy = subscribeSpyTo(TestBed.inject(EVENTS))

         fixture.detectChanges()
         expect(spy.getValuesLength()).withContext("after first change detection").toBe(1)

         fixture.componentInstance.count = 10
         expect(spy.getValuesLength()).withContext("before count change detection").toBe(1)

         fixture.detectChanges()
         expect(spy.getValuesLength()).withContext("after count change detection").toBe(2)

         fixture.detectChanges()
         fixture.detectChanges()
         expect(spy.getValuesLength()).withContext("ensure value is stable").toBe(2)
      })
   })

   describe("Select", () => {
      it("should only evaluate selectors once per change", () => {
         const double = createSpy()
         const plusOne = createSpy()
         const doublePlusOne = createSpy()
         @Store()
         @Component({ template: `` })
         class UITest {
            count = 10
            @Select() get double() {
               double()
               return this.count * 2
            }
            @Select() get plusOne() {
               plusOne()
               return this.count + 1
            }
            @Select() get doublePlusOne() {
               doublePlusOne()
               return this.double + this.plusOne
            }
         }
         const { componentInstance } = createComponent(UITest)

         expect(double).not.toHaveBeenCalled()
         expect(plusOne).not.toHaveBeenCalled()
         expect(doublePlusOne).not.toHaveBeenCalled()

         expect(componentInstance.double).toBe(20)
         expect(componentInstance.plusOne).toBe(11)
         expect(componentInstance.doublePlusOne).toBe(31)

         expect(double).toHaveBeenCalledTimes(1)
         expect(plusOne).toHaveBeenCalledTimes(1)
         expect(doublePlusOne).toHaveBeenCalledTimes(1)

         componentInstance.count = 100

         expect(double).toHaveBeenCalledTimes(1)
         expect(plusOne).toHaveBeenCalledTimes(1)
         expect(doublePlusOne).toHaveBeenCalledTimes(1)

         expect(componentInstance.double).toBe(200)
         expect(componentInstance.plusOne).toBe(101)
         expect(componentInstance.doublePlusOne).toBe(301)

         expect(double).toHaveBeenCalledTimes(2)
         expect(plusOne).toHaveBeenCalledTimes(2)
         expect(doublePlusOne).toHaveBeenCalledTimes(2)
      })
   })

   xdescribe("Caught", () => {

   })
})
