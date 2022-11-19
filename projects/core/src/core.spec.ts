import {ApplicationRef, Component, ElementRef, inject, Input, Type} from "@angular/core";
import {ComponentFixture, fakeAsync, flush, TestBed} from "@angular/core/testing";
import {concat, finalize, from, NEVER, Observable, of, TeardownLogic, throwError} from "rxjs";
import {subscribeSpyTo} from "@hirez_io/observer-spy";
import {dispatch} from "./dispatch";
import {addTeardown, useInputs} from "./hooks";
import {EVENTS} from "./providers";
import createSpy = jasmine.createSpy;
import Spy = jasmine.Spy;
import objectContaining = jasmine.objectContaining;
import {Action, Caught, Invoke, Select, Store} from "./decorators";

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

         @Action() addTeardown(teardown: TeardownLogic) {
            addTeardown(teardown)
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

      it("should dispatch effects", fakeAsync(() => {
         const fixture = createComponent(UITest)
         const result = fixture.componentInstance.dispatchEffects(of(1), from([10, 20, 30]), throwError(() => new Error("BOGUS")))
         const observerSpy = subscribeSpyTo(result, { expectErrors: true });

         expect(observerSpy.receivedNext()).toBeFalse()
         expect(observerSpy.receivedError()).toBeFalse()
         expect(observerSpy.receivedComplete()).toBeFalse()

         fixture.detectChanges()
         expect(() => flush()).toThrow()

         expect(observerSpy.getValues()).toEqual([1, 10, 20, 30])
         expect(observerSpy.getError()).toEqual(new Error("BOGUS"))
      }))

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

      it("should execute teardown logic before each action and on destroy", () => {
         const teardown = createSpy()
         const fixture = createComponent(UITest)

         fixture.componentInstance.addTeardown(teardown)

         expect(teardown).toHaveBeenCalledTimes(0)

         fixture.componentInstance.addTeardown(teardown)

         expect(teardown).toHaveBeenCalledTimes(1)

         fixture.destroy()

         expect(teardown).toHaveBeenCalledTimes(2)
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

      it("should react to input changes", () => {
         @Store()
         @Component({ template: `` })
         class UITest {
            @Input() count = 0
            @Invoke() iAmReactive() {
               const { count } = useInputs<UITest>()
               iAmReactive(count)
            }
         }
         const iAmReactive = createSpy()
         const fixture = createComponent(UITest)

         fixture.componentRef.setInput("count", 10)
         fixture.detectChanges()
         expect(iAmReactive).toHaveBeenCalledWith(objectContaining({ currentValue: 10, previousValue: undefined }))
         expect(iAmReactive).toHaveBeenCalledTimes(1)

         fixture.detectChanges()
         fixture.detectChanges()
         expect(iAmReactive).toHaveBeenCalledTimes(1)

         fixture.componentRef.setInput("count", 20)
         fixture.detectChanges()
         expect(iAmReactive).toHaveBeenCalledWith(objectContaining({ currentValue: 20, previousValue: 10 }))
         expect(iAmReactive).toHaveBeenCalledTimes(2)
      })
   })

   describe("Select", () => {
      it("should only evaluate selectors once per change", () => {
         @Store()
         @Component({ template: `` })
         class UITest {
            count = 10
            multiplier = 2
            @Select() get multiply() {
               multiply()
               return this.count * this.multiplier
            }
            @Select() get plusOne() {
               plusOne()
               return this.count + 1
            }
            @Select() get multiplyPlusOne() {
               multiplyPlusOne()
               return this.multiply + this.plusOne
            }
         }
         const multiply = createSpy()
         const plusOne = createSpy()
         const multiplyPlusOne = createSpy()
         const { componentInstance } = createComponent(UITest)

         expect(multiply).not.toHaveBeenCalled()
         expect(plusOne).not.toHaveBeenCalled()
         expect(multiplyPlusOne).not.toHaveBeenCalled()

         expect(componentInstance.multiply).toBe(20)
         expect(componentInstance.plusOne).toBe(11)
         expect(componentInstance.multiplyPlusOne).toBe(31)

         expect(multiply).toHaveBeenCalledTimes(1)
         expect(multiply).toHaveBeenCalledTimes(1)
         expect(plusOne).toHaveBeenCalledTimes(1)
         expect(plusOne).toHaveBeenCalledTimes(1)
         expect(multiplyPlusOne).toHaveBeenCalledTimes(1)
         expect(multiplyPlusOne).toHaveBeenCalledTimes(1)

         componentInstance.count = 100
         componentInstance.multiplier = 4

         expect(multiply).toHaveBeenCalledTimes(1)
         expect(plusOne).toHaveBeenCalledTimes(1)
         expect(multiplyPlusOne).toHaveBeenCalledTimes(1)

         expect(componentInstance.multiply).toBe(400)
         expect(componentInstance.plusOne).toBe(101)
         expect(componentInstance.multiplyPlusOne).toBe(501)

         expect(multiplyPlusOne).toHaveBeenCalledTimes(2)
         expect(plusOne).toHaveBeenCalledTimes(2)
         expect(multiply).toHaveBeenCalledTimes(2)
      })

      it("should memoize parameters", () => {
         @Store()
         @Component({ template: `` })
         class UITest {
            list = [1, 2, 3]

            @Select() filterValues(value: number) {
               filterValues()
               return this.list.filter((item) => item === value)
            }
         }
         const filterValues = createSpy()
         const fixture = createComponent(UITest)

         expect(fixture.componentInstance.filterValues(1)).toEqual([1])
         expect(fixture.componentInstance.filterValues(1)).toEqual([1])
         expect(filterValues).toHaveBeenCalledTimes(1)
         expect(fixture.componentInstance.filterValues(2)).toEqual([2])
         expect(fixture.componentInstance.filterValues(2)).toEqual([2])
         expect(filterValues).toHaveBeenCalledTimes(2)
         expect(fixture.componentInstance.filterValues(3)).toEqual([3])
         expect(fixture.componentInstance.filterValues(3)).toEqual([3])
         expect(filterValues).toHaveBeenCalledTimes(3)

         fixture.componentInstance.list = [1, 2, 3]

         expect(fixture.componentInstance.filterValues(1)).toEqual([1])
         expect(fixture.componentInstance.filterValues(1)).toEqual([1])
         expect(filterValues).toHaveBeenCalledTimes(4)
      })

      it("should compose parameterized selectors", () => {
         @Store()
         @Component({ template: `` })
         class UITest {
            list = [1, 2, 3]

            @Select() selectValues(value: number) {
               selectValues()
               return this.list.filter((item) => item === value)
            }

            @Select() selectAndMultiplyValues(value: number, multiplier: number) {
               selectAndMultiplyValues()
               return this.selectValues(value).map(item => item * multiplier)
            }
         }
         const selectValues = createSpy()
         const selectAndMultiplyValues = createSpy()
         const fixture = createComponent(UITest)

         expect(fixture.componentInstance.selectValues(1)).toEqual([1])
         expect(fixture.componentInstance.selectAndMultiplyValues(1, 2)).toEqual([2])
         expect(fixture.componentInstance.selectAndMultiplyValues(1, 2)).toEqual([2])
         expect(selectValues).toHaveBeenCalledTimes(1)
         expect(selectAndMultiplyValues).toHaveBeenCalledTimes(1)

         expect(fixture.componentInstance.selectAndMultiplyValues(1, 4)).toEqual([4])
         expect(fixture.componentInstance.selectAndMultiplyValues(1, 4)).toEqual([4])
         expect(selectValues).toHaveBeenCalledTimes(1)
         expect(selectAndMultiplyValues).toHaveBeenCalledTimes(2)

         expect(fixture.componentInstance.selectAndMultiplyValues(2, 4)).toEqual([8])
         expect(fixture.componentInstance.selectAndMultiplyValues(2, 4)).toEqual([8])
         expect(selectValues).toHaveBeenCalledTimes(2)
         expect(selectAndMultiplyValues).toHaveBeenCalledTimes(3)

         fixture.componentInstance.list = [1, 2, 3]

         expect(fixture.componentInstance.selectAndMultiplyValues(2, 4)).toEqual([8])
         expect(fixture.componentInstance.selectAndMultiplyValues(2, 4)).toEqual([8])
         expect(fixture.componentInstance.selectValues(2)).toEqual([2])
         expect(selectValues).toHaveBeenCalledTimes(3)
         expect(selectAndMultiplyValues).toHaveBeenCalledTimes(4)
      })
   })

   describe("Caught", () => {
      it("should not catch action errors when decorator is not present", () => {
         @Store()
         @Component({ template: `` })
         class UITest {
            @Action() iThrowErrors(error: unknown) {
               throw error
            }
         }
         const fixture = createComponent(UITest)

         try {
            fixture.componentInstance.iThrowErrors(new Error("BOGUS"))
         } catch (e) {
            expect(e).toEqual(new Error("BOGUS"))
         }
      })

      it("should catch action errors", () => {
         @Store()
         @Component({ template: `` })
         class UITest {
            @Action() iThrowErrors(error: unknown) {
               throw error
            }
            @Caught() iCatchErrors(error: unknown) {
               spy(error)
            }
         }
         const spy = createSpy()
         const fixture = createComponent(UITest)

         expect(() => fixture.componentInstance.iThrowErrors(new Error("BOGUS"))).toThrow()

         expect(spy).toHaveBeenCalledOnceWith(new Error("BOGUS"))
      })

      it("should call error handlers in order until the error is handled", () => {
         @Store()
         @Component({ template: `` })
         class UITest {
            @Action() iThrowErrors(error: unknown) {
               throw error
            }
            @Caught() iAmCalledFirst(error: unknown) {
               iAmCalledFirst(error)
               throw error
            }
            @Caught() iAmCalledNext(error: unknown) {
               iAmCalledNext(error)
               throw error
            }
            @Caught() iCatchErrors(error: unknown) {
               iCatchErrors(error)
            }
         }
         const iAmCalledFirst = createSpy()
         const iAmCalledNext = createSpy()
         const iCatchErrors = createSpy()
         const error = new Error("BOGUS")
         const fixture = createComponent(UITest)

         expect(() => fixture.componentInstance.iThrowErrors(error)).toThrow()

         expect(iAmCalledFirst).toHaveBeenCalledOnceWith(error)
         expect(iAmCalledFirst).toHaveBeenCalledBefore(iAmCalledNext)
         expect(iAmCalledNext).toHaveBeenCalledOnceWith(error)
         expect(iAmCalledNext).toHaveBeenCalledBefore(iCatchErrors)
         expect(iCatchErrors).toHaveBeenCalledOnceWith(error)
         TestBed.resetTestingModule()
      })

      it("should rethrow if error isn't handled", () => {
         @Store()
         @Component({ template: `` })
         class UITest {
            @Action() iThrowErrors(error: unknown) {
               throw error
            }
            @Caught() iRethrowErrors(error: unknown) {
               throw error
            }
            @Caught() iAlsoRethrowErrors(error: unknown) {
               throw error
            }
         }
         const error = new Error("BOGUS")
         const fixture = createComponent(UITest)

         try {
            fixture.componentInstance.iThrowErrors(error)
         } catch (e) {
            expect(e).toBe(error)
         }
      })

      it("should catch errors from dispatched effects", fakeAsync(() => {
         @Store()
         @Component({ template: `` })
         class UITest {
            @Action() iDispatchEffectErrors(effect: Observable<any>) {
               return dispatch(effect)
            }
            @Caught() iCatchErrors(error: unknown) {
               iCatchErrors(error)
            }
         }
         const iCatchErrors = createSpy()
         const fixture = createComponent(UITest)
         const result = fixture.componentInstance.iDispatchEffectErrors(throwError(() => new Error("BOGUS")))
         const observerSpy = subscribeSpyTo(result, { expectErrors: true })

         fixture.detectChanges()
         expect(() => flush()).toThrow()

         expect(observerSpy.getError()).toEqual(new Error("BOGUS"))
         expect(iCatchErrors).toHaveBeenCalledOnceWith(new Error("BOGUS"))
      }))

      it("should also catch effects with error observers", fakeAsync(() => {
         @Store()
         @Component({ template: `` })
         class UITest {
            @Action() iDispatchEffectErrors(effect: Observable<any>) {
               return dispatch(effect, {
                  error
               })
            }
            @Caught() iCatchErrors(error: unknown) {
               iCatchErrors(error)
            }
         }
         const error = createSpy()
         const iCatchErrors = createSpy()
         const fixture = createComponent(UITest)
         const result = fixture.componentInstance.iDispatchEffectErrors(throwError(() => new Error("BOGUS")))
         const observerSpy = subscribeSpyTo(result, { expectErrors: true })

         fixture.detectChanges()
         expect(() => flush()).toThrow()

         expect(error).toHaveBeenCalledOnceWith(new Error("BOGUS"))
         expect(observerSpy.getError()).toEqual(new Error("BOGUS"))
         expect(iCatchErrors).toHaveBeenCalled()

      }))
   })
})
