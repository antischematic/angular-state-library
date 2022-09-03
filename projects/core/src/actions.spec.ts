import {ChangeDetectorRef, Component, ElementRef, ErrorHandler, inject} from "@angular/core";
import {fakeAsync, flushMicrotasks, TestBed, tick} from "@angular/core/testing";
import {filter, map, mergeAll, Observable, of, tap, throwError, timer} from "rxjs";
import {
  Action,
  ActionType, Before,
  Caught,
  createDispatch,
  createEffect,
  Dispatcher,
  DISPATCHER,
  EventType,
  fromAction, Invoke, Layout,
  Select,
  Store
} from "./actions";
import createSpy = jasmine.createSpy;

describe("Library", () => {

  describe("State decorator", () => {
    it("should be a class decorator", () => {
      @Store()
      class Test {}
      expect(Test).toBeInstanceOf(Function)
    })
  })

  describe("Action decorator", () => {
    it("should be a method decorator", () => {
      @Store()
      class Test {
        @Action() action() {}
      }
      expect(Test).toBeInstanceOf(Function)
    })

    it("should attach the ngDoCheck lifecycle hook", () => {
      @Store()
      class Test {
        @Action() action() {}
      }
      expect(Reflect.get(Test.prototype, "ngDoCheck")).toBeInstanceOf(Function)
    })

    it("should be called immediately on first change detection", () => {
      const spy = createSpy()
      @Store()
      @Component({ template: `` })
      class Test {
        @Invoke() action() { spy() }
      }
      const fixture = TestBed.configureTestingModule({ declarations: [Test] }).createComponent(Test)

      fixture.detectChanges()

      expect(spy).toHaveBeenCalledTimes(1)
    })

    it("should not be called immediately if action has arguments", () => {
      const spy = createSpy()
      @Store()
      @Component({ template: `` })
      class Test {
        @Invoke() action(arg: any) { spy(arg) }
      }
      const fixture = TestBed.configureTestingModule({ declarations: [Test] }).createComponent(Test)

      fixture.detectChanges()
      expect(spy).toHaveBeenCalledTimes(0)

      fixture.componentInstance.action(10)
      expect(spy).toHaveBeenCalledOnceWith(10)
    })

    it("should be called immediately if action has default arguments", () => {
      const spy = createSpy()
      @Store()
      @Component({ template: `` })
      class Test {
        @Invoke() action(arg = 1337) { spy(arg) }
      }
      const fixture = TestBed.configureTestingModule({ declarations: [Test] }).createComponent(Test)

      fixture.detectChanges()

      expect(spy).toHaveBeenCalledOnceWith(1337)
    })

    it("should not be called again when shallow dependencies haven't changed", () => {
      const spy = createSpy()
      @Store()
      @Component({ template: `` })
      class Test {
        count = 0
        @Invoke() action() { spy(this.count) }
      }
      const fixture = TestBed.configureTestingModule({ declarations: [Test] }).createComponent(Test)

      fixture.detectChanges()
      fixture.detectChanges()
      fixture.detectChanges()

      expect(spy).toHaveBeenCalledOnceWith(0)
    })

    it("should be called again when shallow dependencies change", () => {
      const spy = createSpy()
      @Store()
      @Component({ template: `` })
      class Test {
        count = 0
        @Invoke() action() { spy(this.count) }
      }
      const fixture = TestBed.configureTestingModule({ declarations: [Test] }).createComponent(Test)

      fixture.detectChanges()
      fixture.detectChanges()
      expect(spy).toHaveBeenCalledOnceWith(0)

      fixture.componentInstance.count = 10
      fixture.detectChanges()
      fixture.detectChanges()

      expect(spy).toHaveBeenCalledTimes(2)
    })

    it("should not track dependencies when { track: false }", () => {
      const spy = createSpy()
      @Store()
      @Component({ template: `` })
      class Test {
        count = 0
        @Invoke({ track: false }) action() { spy(this.count) }
      }
      const fixture = TestBed.configureTestingModule({ declarations: [Test] }).createComponent(Test)

      fixture.detectChanges()
      fixture.detectChanges()

      expect(spy).toHaveBeenCalledTimes(1)

      fixture.componentInstance.count = 10
      fixture.detectChanges()
      fixture.detectChanges()

      expect(spy).toHaveBeenCalledTimes(1)
    })

    it("should be called before ngAfterContentChecked when { content: true }", () => {
      const spy = createSpy("action")
      const ngDoCheck = createSpy("ngDoCheck")
      const ngAfterContentChecked = createSpy("ngAfterContentChecked")
      const ngAfterViewChecked = createSpy("ngAfterViewChecked")
      @Store()
      @Component({ template: `` })
      class Test {
        count = 0
        @Before() action() {
          spy(this.count)
        }

        ngDoCheck() { ngDoCheck() }
        ngAfterContentChecked() { ngAfterContentChecked() }
        ngAfterViewChecked() { ngAfterViewChecked() }
      }
      const fixture = TestBed.configureTestingModule({ declarations: [Test] }).createComponent(Test)

      fixture.detectChanges()

      expect(ngDoCheck).toHaveBeenCalledBefore(spy)
      expect(spy).toHaveBeenCalledBefore(ngAfterContentChecked)
      expect(spy).toHaveBeenCalledBefore(ngAfterViewChecked)
    })

    it("should be called during ngAfterViewChecked when { view: true }", () => {
      const spy = createSpy("action")
      const ngDoCheck = createSpy("ngDoCheck")
      const ngAfterContentChecked = createSpy("ngAfterContentChecked")
      const ngAfterViewChecked = createSpy("ngAfterViewChecked")
      @Store()
      @Component({ template: `` })
      class Test {
        count = 0
        @Layout() action() {
          spy(this.count)
        }

        ngDoCheck() { ngDoCheck() }
        ngAfterContentChecked() { ngAfterContentChecked() }
        ngAfterViewChecked() { ngAfterViewChecked() }
      }
      const fixture = TestBed.configureTestingModule({ declarations: [Test] }).createComponent(Test)

      fixture.detectChanges()

      expect(ngDoCheck).toHaveBeenCalledBefore(spy)
      expect(ngAfterContentChecked).toHaveBeenCalledBefore(spy)
      expect(spy).toHaveBeenCalledBefore(ngAfterViewChecked)
    })

    it("should be injectable", () => {
      @Store()
      @Component({template: ``})
      class Test {
        count = 0

        @Action({check: false, view: true}) action() {
          inject(ElementRef)
          inject(Dispatcher)
        }
      }

      const fixture = TestBed.configureTestingModule({declarations: [Test]}).createComponent(Test)

      fixture.detectChanges()

      expect(() => fixture.componentInstance.action()).not.toThrow()
    })
  })

  describe("Select decorator", () => {
    it("should create", () => {
      @Store()
      @Component({ template: `` })
      class Test {
        count = 0

        @Select() get double() {
          return this.count * 2
        }

        @Select() select(args: any) {
          return this.count
        }
      }

      expect(Test).toBeTruthy()
    })

    it("should memoize getter dependencies", () => {
      const spy = createSpy("double")
      @Store()
      @Component({ template: `` })
      class Test {
        count = 10

        @Select() get double() {
          spy()
          return this.count * 2
        }
      }

      const fixture = TestBed.configureTestingModule({declarations: [Test]}).createComponent(Test)

      expect(spy).not.toHaveBeenCalled()

      const result = fixture.componentInstance.double

      expect(spy).toHaveBeenCalledTimes(1)
      expect(result).toBe(20)

      fixture.componentInstance.double
      fixture.componentInstance.double

      expect(spy).toHaveBeenCalledTimes(1)

      fixture.componentInstance.count = 20

      const result2 = fixture.componentInstance.double

      expect(spy).toHaveBeenCalledTimes(2)
      expect(result2).toBe(40)

      fixture.componentInstance.double
      fixture.componentInstance.double

      expect(spy).toHaveBeenCalledTimes(2)
    })

    it("should memoize function arguments and dependencies", () => {
      const spy = createSpy("double")
      @Store()
      @Component({ template: `` })
      class Test {
        list = [1, 2, 3]

        @Select() select(value: number) {
          spy()
          return this.list.filter((item) => item === value)
        }
      }
      const fixture = TestBed.configureTestingModule({declarations: [Test]}).createComponent(Test)

      fixture.componentInstance.select(1)
      fixture.componentInstance.select(1)
      const result = fixture.componentInstance.select(1)

      expect(result).toEqual([1])
      expect(spy).toHaveBeenCalledTimes(1)

      const result2 = fixture.componentInstance.select(2)

      fixture.componentInstance.select(1)
      fixture.componentInstance.select(2)

      expect(result2).toEqual([2])
      expect(spy).toHaveBeenCalledTimes(2)

      fixture.componentInstance.list = [4, 5, 6]
      const result3 = fixture.componentInstance.select(4)
      const result4 = fixture.componentInstance.select(5)

      fixture.componentInstance.select(4)
      fixture.componentInstance.select(5)

      expect(result3).toEqual([4])
      expect(result4).toEqual([5])
      expect(spy).toHaveBeenCalledTimes(4)
    })
  })

  describe("Caught decorator", () => {
    it("should create", () => {
      const spy = createSpy()
      @Store()
      @Component({template: ``})
      class Test {
        @Action({ track: false, immediate: false }) actionError() {
          throw new Error("actionError")
        }

        @Action({ track: false, immediate: false }) effectError() {
          return dispatch(throwError(() => new Error("effectError")))
        }

        @Action({ track: false, immediate: false }) dispatchError() {
          return dispatch(of(1), {
            next() {
              throw new Error("dispatchError")
            }
          })
        }

        @Action({ track: false, immediate: false }) rethrowActionError() {
          return dispatch(throwError(() => new Error()), {
            error(error: unknown) {
              throw "rethrowActionError"
            }
          })
        }

        @Action({ track: false, immediate: false }) actionWithHandledError() {
          return dispatch(throwError(() => new Error("actionWithHandledError")), {
            error(error: unknown) {
              spy('handled!')
            }
          })
        }

        @Action({ track: false, immediate: false }) throwLast() {
          throw "throwLast"
        }

        @Caught() rethrowError(error: unknown) {
          throw error
        }

        @Caught() caughtError(error: unknown) {
          if (error === "throwLast") {
            throw error
          }
          spy(error)
        }
      }

      const dispatch = createDispatch(Test)
      const fixture = TestBed.configureTestingModule({declarations: [Test]}).createComponent(Test)
      const errorHandler = TestBed.inject(ErrorHandler)
      spyOn(errorHandler, "handleError")

      fixture.detectChanges()

      expect(() => fixture.componentInstance.actionError()).not.toThrow()
      expect(spy).toHaveBeenCalledOnceWith(new Error("actionError"))
      expect(errorHandler.handleError).not.toHaveBeenCalled()
      spy.calls.reset()

      fixture.componentInstance.effectError()
      fixture.detectChanges()

      expect(spy).toHaveBeenCalledOnceWith(new Error("effectError"))
      expect(errorHandler.handleError).not.toHaveBeenCalled()
      spy.calls.reset()

      fixture.componentInstance.dispatchError()
      fixture.detectChanges()

      expect(spy).toHaveBeenCalledOnceWith(new Error("dispatchError"))
      expect(errorHandler.handleError).not.toHaveBeenCalled()
      spy.calls.reset()

      fixture.componentInstance.rethrowActionError()
      fixture.detectChanges()

      expect(spy).toHaveBeenCalledOnceWith("rethrowActionError")
      expect(errorHandler.handleError).not.toHaveBeenCalled()
      spy.calls.reset()

      fixture.componentInstance.actionWithHandledError()
      fixture.detectChanges()

      expect(spy).toHaveBeenCalledOnceWith('handled!')
      expect(errorHandler.handleError).not.toHaveBeenCalled()
      spy.calls.reset()

      fixture.componentInstance.throwLast()
      fixture.detectChanges()

      expect(spy).not.toHaveBeenCalled()
      expect(errorHandler.handleError).toHaveBeenCalledOnceWith("throwLast")
    })
  })

  describe("createDispatch", () => {
    it("should create", fakeAsync(() => {
      @Store()
      @Component({template: ``})
      class Test {
        count = 0

        @Action({ immediate: true }) action() {
          return dispatch(timer(2000), {
            next() {
              this.count += 1
            }
          })
        }
      }
      const dispatch = createDispatch(Test)
      const fixture = TestBed.configureTestingModule({declarations: [Test]}).createComponent(Test)

      fixture.detectChanges()
      tick(2000)
      fixture.detectChanges()

      expect(fixture.componentInstance.count).toBe(1)
    }))
  })

  describe("createEffect", () => {
    it("should create", fakeAsync(() => {
      @Store()
      @Component({template: ``})
      class Test {
        count = 0

        @Action({ immediate: true }) action() {
          return dispatch(createEffect(timer(2000), mergeAll()), {
            next() {
              this.count += 1
            }
          })
        }
      }
      const dispatch = createDispatch(Test)
      const fixture = TestBed.configureTestingModule({declarations: [Test]}).createComponent(Test)

      fixture.detectChanges()
      tick(2000)
      fixture.detectChanges()

      expect(fixture.componentInstance.count).toBe(1)
    }))
  })

  describe("fromAction", () => {
    it("should create", fakeAsync(() => {

      @Store()
      @Component({template: ``})
      class Test {
        count = 0

        @Action({ immediate: true }) action() {
          return dispatch(createEffect(timer(2000), mergeAll()))
        }

        @Action() actionWithArgs(...args: any[]) {
          return dispatch(createEffect(timer(2000), mergeAll()))
        }

        @Action({ immediate: true }) saga(): Observable<unknown> {
          const effect = fromAction(Test).pipe(
            tap(() => this.count += 1),
            filter(event => ["actionWithArgs", "action"].includes(event.name)),
            map(event => `${event.name}.${event.type}`)
          )

          return dispatch(effect)
        }

        constructor(cdr: ChangeDetectorRef) {
           cdr.detach()
        }
      }
      const dispatch = createDispatch(Test)
      const fixture = TestBed.configureTestingModule({declarations: [Test]}).createComponent(Test)
      const dispatcher = TestBed.inject(DISPATCHER)
      const spy = createSpy()

      dispatcher.subscribe(spy)
      fixture.detectChanges()
      flushMicrotasks()

      expect(spy).toHaveBeenCalledWith(<EventType>{
        name: "action",
        context: fixture.componentInstance,
        type: ActionType.Dispatch,
        value: []
      })

      expect(spy).toHaveBeenCalledWith(<EventType>{
        name: "saga",
        context: fixture.componentInstance,
        type: ActionType.Dispatch,
        value: []
      })

      expect(spy).toHaveBeenCalledWith(<EventType>{
        name: "saga",
        context: fixture.componentInstance,
        type: ActionType.Next,
        value: "action.dispatch"
      })

      expect(spy).toHaveBeenCalledTimes(3)

      fixture.componentInstance.actionWithArgs(10, 20, 30)
      fixture.detectChanges()
      flushMicrotasks()

      expect(spy).toHaveBeenCalledWith(<EventType>{
        name: "actionWithArgs",
        context: fixture.componentInstance,
        type: ActionType.Dispatch,
        value: [10, 20, 30]
      })

      expect(spy).toHaveBeenCalledWith(<EventType>{
        name: "saga",
        context: fixture.componentInstance,
        type: ActionType.Next,
        value: "actionWithArgs.dispatch"
      })

      tick(2000)

      expect(spy).toHaveBeenCalledWith(<EventType>{
        name: "action",
        context: fixture.componentInstance,
        type: ActionType.Next,
        value: 0
      })

      expect(spy).toHaveBeenCalledWith(<EventType>{
        name: "saga",
        context: fixture.componentInstance,
        type: ActionType.Next,
        value: "action.next"
      })

      expect(spy).toHaveBeenCalledWith(<EventType>{
        name: "action",
        context: fixture.componentInstance,
        type: ActionType.Complete,
      })

      expect(spy).toHaveBeenCalledWith(<EventType>{
        name: "saga",
        context: fixture.componentInstance,
        type: ActionType.Next,
        value: "action.complete"
      })

      expect(spy).toHaveBeenCalledWith(<EventType>{
        name: "actionWithArgs",
        context: fixture.componentInstance,
        type: ActionType.Next,
        value: 0
      })

      expect(spy).toHaveBeenCalledWith(<EventType>{
        name: "saga",
        context: fixture.componentInstance,
        type: ActionType.Next,
        value: "actionWithArgs.next"
      })

      expect(spy).toHaveBeenCalledWith(<EventType>{
        name: "actionWithArgs",
        context: fixture.componentInstance,
        type: ActionType.Complete,
      })

      expect(spy).toHaveBeenCalledWith(<EventType>{
        name: "saga",
        context: fixture.componentInstance,
        type: ActionType.Next,
        value: "actionWithArgs.complete"
      })

      expect(spy).toHaveBeenCalledTimes(13)

      expect(fixture.componentInstance.count).toBe(13)
    }))
  })
})
