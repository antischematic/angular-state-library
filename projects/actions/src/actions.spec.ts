import {
  Component,
  createEnvironmentInjector,
  ElementRef,
  EnvironmentInjector,
  inject,
  Injectable,
  InjectionToken,
  INJECTOR,
  Type,
  ɵɵdirectiveInject as directiveInject
} from "@angular/core";
import {fakeAsync, TestBed, tick} from "@angular/core/testing";
import {createProxy, runInContext} from "./proxy";
import {
  catchError,
  EMPTY,
  filter,
  isObservable,
  map,
  mergeAll,
  MonoTypeOperatorFunction,
  Observable,
  ObservableInput,
  OperatorFunction,
  PartialObserver,
  Subject,
  Subscription,
  tap,
  timer
} from "rxjs";
import createSpy = jasmine.createSpy;

const meta = new WeakMap()

export function ensureKey(target: WeakMap<any, any>, key: any) {
  return target.has(key) ? target.get(key)! : target.set(key, new Map()).get(key)!
}

function getMetaKeys(metaKey: any, target: object) {
  return ensureKey(ensureKey(meta, target), metaKey)
}

function getMeta(metaKey: any, target: object, key?: PropertyKey): unknown {
  return getMetaKeys(metaKey, target).get(key)
}

function setMeta(metaKey: any, value: any, target: object, key?: PropertyKey) {
  return ensureKey(ensureKey(meta, target), metaKey).set(key, value)
}

interface ActionConfig {
  track?: boolean
  immediate?: boolean
  check?: boolean
  content?: boolean
  view?: boolean
}

type ActionMeta = { key: PropertyKey, method: Function, config: ActionConfig }

type SelectMeta = { key: PropertyKey, descriptor: PropertyDescriptor, config: ActionConfig }

function wrap(target: { [key: PropertyKey]: any }, key: PropertyKey, fn: (this: any, ...args: any[]) => any) {
  const originalFunction = target[key] ?? Function
  Object.defineProperty(target, key, {
    configurable: true,
    value: function (this: unknown, ...args: any[]) {
      return fn.call(this, originalFunction, ...args)
    }
  })
}

function decorateLifecycleHook(prototype: object, key: string, actions: ActionMeta[]) {
  if (actions.length) {
    wrap(prototype, key, function (fn) {
      for (const action of actions) {
        const deps = getMeta("deps", this, action.key) as Map<any, any>
        if (deps) {
          outer: for (const [object, keyValue] of deps) {
            for (const [key, value] of keyValue) {
              if (object[key] !== value) {
                this[action.key].call(this)
                break outer
              }
            }
          }
        } else if (action.config.immediate && action.method.length === 0) {
          this[action.key].call(this)
        }
      }
      fn.apply(this)
    })
  }
}

@Injectable()
class Effect {
  operator!: MonoTypeOperatorFunction<any>
  source = new Subject()
  destination = new Subject()
  subscription = Subscription.EMPTY
  connected = false

  next(source: Observable<any>) {
    this.source.next(source)
  }

  subscribe(observer: PartialObserver<any>) {
    if (this.connected) {
      return this.destination.subscribe(observer)
    } else {
      this.connected = true
      this.source = new Subject()
      this.destination = new Subject()
      const subscription = this.destination.subscribe(observer)
      this.subscription = this.source.pipe(this.operator).subscribe(this.destination)
      return subscription
    }
  }

  ngOnDestroy() {
    this.subscription.unsubscribe()
  }
}

enum ActionType {
  Dispatch,
  Next,
  Error,
  Complete
}

@Injectable()
class Dispatcher {
  context!: object
  action!: PropertyKey
  tries = 1
  subscription = Subscription.EMPTY
  dispatcher = inject(DISPATCHER)
  source: Observable<any> = EMPTY
  connected = true
  dirty = false
  payload = []

  next(value: any) {
    this.tries = 1
    this.dispatcher.next({
      name: this.action,
      context: this.context,
      value,
      type: ActionType.Next
    })
  }

  error(error: unknown) {
    this.dispatcher.next({
      name: this.action,
      context: this.context,
      error,
      tries: this.tries++,
      type: ActionType.Error
    })
  }

  complete() {
    this.tries = 1
    this.dispatcher.next({
      name: this.action,
      context: this.context,
      type: ActionType.Complete
    })
  }

  connect() {
    if (!this.connected) {
      this.connected = true
      this.subscription.unsubscribe()
      this.subscription = this.source.subscribe(this)
    }
  }

  flush() {
    if (this.dirty) {
      this.dirty = false
      this.dispatcher.next({
        name: this.action,
        context: this.context,
        value: this.payload,
        type: ActionType.Dispatch
      })
    }
  }

  dispatch(context: object, action: PropertyKey, payload: any, effect: any) {
    this.dirty = true
    this.action = action
    this.context = context
    this.payload = payload

    if (isObservable(effect)) {
      this.connected = false
      this.source = effect
    }
  }

  ngOnDestroy() {
    this.subscription.unsubscribe()
  }
}

function State() {
  return function (target: Function) {
    const { prototype } = target
    const selectors = Array.from(getMetaKeys(Select, prototype).values()) as SelectMeta[]
    const actions = Array.from(getMetaKeys(Action, prototype).values()) as ActionMeta[]
    const checkActions = actions.filter((action) => action.config.check)
    const contentActions = actions.filter((action) => action.config.content)
    const viewActions = actions.filter((action) => action.config.view)

    decorateLifecycleHook(prototype, "ngDoCheck", checkActions)
    decorateLifecycleHook(prototype, "ngAfterContentChecked", contentActions)
    decorateLifecycleHook(prototype, "ngAfterViewChecked", viewActions)

    wrap(prototype, "ngOnInit", function (fn) {
      const parent = directiveInject(INJECTOR)
      for (const action of actions) {
        const injector = createEnvironmentInjector([Dispatcher, Effect], parent as EnvironmentInjector)
        setMeta(INJECTOR, injector, this, action.key)
      }
      fn.apply(this)
    })

    if (selectors.length) {
      for (const selector of selectors) {
        const { get, value } = selector.descriptor
        if (get) {
          Object.defineProperty(prototype, selector.key, {
            get: function () {
              const deps = getMeta("deps", this, selector.key) as Map<any, any>
              let changed = !deps
              if (deps) {
                outer: for (const [object, keyValue] of deps) {
                  for (const [key, value] of keyValue) {
                    if (object[key] !== value) {
                      changed = true
                      break outer
                    }
                  }
                }
              }
              if (changed) {
                const deps = new Map()
                const value = runInContext(deps, () => get.call(selector.config.track ? createProxy(this) : this))
                setMeta("value", value, this, selector.key)
                setMeta("deps", deps, this, selector.key)
              }
              return getMeta("value", this, selector.key)
            }
          })
        } else if (typeof value === "function") {

        } else {
          throw new Error("Selector must be a getter or method")
        }
      }
    }

    wrap(prototype, "ngAfterViewChecked", function (fn) {
      for (const action of actions) {
        (getMeta(INJECTOR, this, action.key) as EnvironmentInjector).get(Dispatcher).connect()
      }
      for (const action of actions) {
        (getMeta(INJECTOR, this, action.key) as EnvironmentInjector).get(Dispatcher).flush()
      }
      fn.apply(this)
    })

    for (const action of actions) {
      wrap(prototype, action.key, function (fn, ...args) {
        const deps = new Map()
        const injector = getMeta(INJECTOR, this, action.key) as EnvironmentInjector
        const dispatcher = injector.get(Dispatcher)
        const result = injector.runInContext(() => runInContext(deps, fn, action.config.track ? createProxy(this, deps) : this, ...args))
        setMeta("deps", deps, this, action.key)
        dispatcher.dispatch(this, action.key, args, result)
        return result
      })
    }
  }
}

const defaultConfig = {
  track: true,
  check: true,
  immediate: true
}

interface DispatchEvent<K = PropertyKey, T = unknown> {
  readonly name: K
  readonly context: object
  readonly value: T
  readonly type: ActionType.Dispatch
}

interface NextEvent<K = PropertyKey, T = unknown> {
  readonly name: K
  readonly context: object
  readonly value: T
  readonly type: ActionType.Next
}

interface ErrorEvent<K = PropertyKey> {
  readonly name: K
  readonly context: object
  readonly error: unknown
  readonly tries: number
  readonly type: ActionType.Error
}

interface CompleteEvent<K = PropertyKey> {
  readonly name: K
  readonly context: object
  readonly type: ActionType.Complete
}

type EventType<ActionKey = PropertyKey, ActionType = unknown, EffectType = unknown> =
  | DispatchEvent<ActionKey, ActionType>
  | NextEvent<ActionKey, EffectType>
  | ErrorEvent<ActionKey>
  | CompleteEvent<ActionKey>

const DISPATCHER = new InjectionToken("Dispatcher", {
  factory() {
    return new Subject<EventType>()
  }
})

function Action(config: ActionConfig = defaultConfig) {
  return function (target: object, key: PropertyKey, descriptor: PropertyDescriptor) {
    setMeta(Action, { method: descriptor.value, key, config: { ...defaultConfig, ...config }}, target, key)
  }
}

function Select(config: ActionConfig = defaultConfig) {
  return function (target: object, key: PropertyKey, descriptor: PropertyDescriptor) {
    setMeta(Select, { descriptor, key, config: { ...defaultConfig, ...config }}, target, key)
  }
}

interface Observer<This, Value> {
  next(this: This, value: Value): void
  error(this: This, error: unknown): void
  complete(this: This): void
  subscribe(this: This): void
  unsubscribe(this: This): void
  finalize(this: This): void
}

function createDispatch<T>(token: Type<T>) {
  return function dispatch<U>(source: Observable<U>, observer?: Partial<Observer<T, U>>): Observable<U> {
    const instance = inject(token)
    return new Observable(subscriber => {
      return source.subscribe({
        next(value) {
          observer?.next?.call(instance, value)
          subscriber.next(value)
        },
        error(error: unknown) {
          observer?.error?.call(instance, error)
          subscriber.error(error)
        },
        complete() {
          observer?.complete?.call(instance)
          subscriber.complete()
        }
      })
    })
  }
}

function createEffect<T>(source: Observable<T>, operator: OperatorFunction<ObservableInput<T>, T>): Observable<T> {
  const effect = inject(Effect)
  effect.operator = operator
  return new Observable(subscriber => {
    const subscription = effect.subscribe(subscriber)
    effect.next(source.pipe(
      catchError((error) => {
        subscriber.error(error)
        return EMPTY
      }),
      tap({
        complete() {
          subscriber.complete()
        }
      })
    ))
    return subscription
  })
}

type ExtractEvents<T, U extends PropertyKey> = {
  [key in U]: key extends keyof T ? T[key] extends (...params: infer P) => Observable<infer R> ? EventType<key, P, R> : never : never
}[U]

type BooleanKeys<T> = {
  [key in keyof T]?: boolean
}

function fromAction<T extends object>(token: Type<T>): Observable<ExtractEvents<T, keyof T>> {
  const context = inject(token)
  const dispatcher = inject(DISPATCHER)
  return dispatcher.pipe(
    filter(event => event.context === context)
  ) as Observable<ExtractEvents<T, keyof T>>
}

describe("Library", () => {

  describe("State decorator", () => {
    it("should be a class decorator", () => {
      @State()
      class Test {}
      expect(Test).toBeInstanceOf(Function)
    })
  })

  describe("Action decorator", () => {
    it("should be a method decorator", () => {
      @State()
      class Test {
        @Action() action() {}
      }
      expect(Test).toBeInstanceOf(Function)
    })

    it("should attach the ngDoCheck lifecycle hook", () => {
      @State()
      class Test {
        @Action() action() {}
      }
      expect(Reflect.get(Test.prototype, "ngDoCheck")).toBeInstanceOf(Function)
    })

    it("should be called immediately on first change detection", () => {
      const spy = createSpy()
      @State()
      @Component({ template: `` })
      class Test {
        @Action() action() { spy() }
      }
      const fixture = TestBed.configureTestingModule({ declarations: [Test] }).createComponent(Test)

      fixture.detectChanges()

      expect(spy).toHaveBeenCalledTimes(1)
    })

    it("should not be called immediately if action has arguments", () => {
      const spy = createSpy()
      @State()
      @Component({ template: `` })
      class Test {
        @Action() action(arg: any) { spy(arg) }
      }
      const fixture = TestBed.configureTestingModule({ declarations: [Test] }).createComponent(Test)

      fixture.detectChanges()
      expect(spy).toHaveBeenCalledTimes(0)

      fixture.componentInstance.action(10)
      expect(spy).toHaveBeenCalledOnceWith(10)
    })

    it("should be called immediately if action has default arguments", () => {
      const spy = createSpy()
      @State()
      @Component({ template: `` })
      class Test {
        @Action() action(arg = 1337) { spy(arg) }
      }
      const fixture = TestBed.configureTestingModule({ declarations: [Test] }).createComponent(Test)

      fixture.detectChanges()

      expect(spy).toHaveBeenCalledOnceWith(1337)
    })

    it("should not be called again when shallow dependencies haven't changed", () => {
      const spy = createSpy()
      @State()
      @Component({ template: `` })
      class Test {
        count = 0
        @Action() action() { spy(this.count) }
      }
      const fixture = TestBed.configureTestingModule({ declarations: [Test] }).createComponent(Test)

      fixture.detectChanges()
      fixture.detectChanges()
      fixture.detectChanges()

      expect(spy).toHaveBeenCalledOnceWith(0)
    })

    it("should be called again when shallow dependencies change", () => {
      const spy = createSpy()
      @State()
      @Component({ template: `` })
      class Test {
        count = 0
        @Action() action() { spy(this.count) }
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
      @State()
      @Component({ template: `` })
      class Test {
        count = 0
        @Action({ track: false }) action() { spy(this.count) }
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
      @State()
      @Component({ template: `` })
      class Test {
        count = 0
        @Action({ check: false, content: true }) action() {
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
      @State()
      @Component({ template: `` })
      class Test {
        count = 0
        @Action({ check: false, view: true }) action() {
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
      @State()
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
      @State()
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
      @State()
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

    })
  })

  describe("Caught decorator", () => {
    it("should create", () => {

    })
  })

  describe("createDispatch", () => {
    it("should create", fakeAsync(() => {
      @State()
      @Component({template: ``})
      class Test {
        count = 0

        @Action() action() {
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
      @State()
      @Component({template: ``})
      class Test {
        count = 0

        @Action() action() {
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

      @State()
      @Component({template: ``})
      class Test {
        count = 0

        @Action() action() {
          return dispatch(createEffect(timer(2000), mergeAll()), {
            next() {
              this.count += 1
            }
          })
        }

        @Action() actionWithArgs(...args: any[]) {
          return dispatch(createEffect(timer(2000), mergeAll()), {
            next() {
              this.count += 1
            }
          })
        }

        @Action() saga(): Observable<unknown> {
          const effect = fromAction(Test).pipe(
            filter(event => ["actionWithArgs", "action"].includes(event.name)),
            map(event => `${event.name}.${ActionType[event.type].toLowerCase()}`)
          )

          return dispatch(effect)
        }
      }
      const dispatch = createDispatch(Test)
      const fixture = TestBed.configureTestingModule({declarations: [Test]}).createComponent(Test)
      const dispatcher = TestBed.inject(DISPATCHER)
      const spy = createSpy()

      dispatcher.subscribe(spy)
      fixture.detectChanges()

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

      expect(spy).toHaveBeenCalledTimes(5)

      fixture.componentInstance.actionWithArgs(10, 20, 30)
      fixture.detectChanges()

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

    }))
  })
})
