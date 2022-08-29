import {
  ChangeDetectorRef,
  createEnvironmentInjector, EnvironmentInjector,
  ErrorHandler,
  inject,
  Injectable, InjectionToken, INJECTOR, Type,
  ɵɵdirectiveInject as directiveInject
} from "@angular/core";
import {
  catchError,
  EMPTY, filter, isObservable,
  MonoTypeOperatorFunction,
  Observable, ObservableInput, OperatorFunction,
  PartialObserver,
  Subject,
  Subscription, tap
} from "rxjs";
import {createProxy, runInContext} from "./proxy";

const meta = new WeakMap()

function ensureKey(target: WeakMap<any, any>, key: any) {
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

export interface ActionConfig {
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
export class Effect {
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

export enum ActionType {
  Dispatch,
  Next,
  Error,
  Complete
}

@Injectable()
export class Dispatcher {
  context!: object
  action!: PropertyKey
  tries = 1
  subscription = Subscription.EMPTY
  dispatcher = inject(DISPATCHER)
  source: Observable<any> = EMPTY
  connected = true
  dirty = false
  payload = []
  errorHandler = inject(ErrorHandler)
  changeDetector = inject(ChangeDetectorRef)

  next(value: any) {
    this.tries = 1
    this.changeDetector.markForCheck()
    this.dispatcher.next({
      name: this.action,
      context: this.context,
      value,
      type: ActionType.Next
    })
  }

  error(error: unknown) {
    handleError(error, this.errorHandler, this.context)
    this.changeDetector.markForCheck()
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
    this.changeDetector.markForCheck()
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

export function Store() {
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
          Object.defineProperty(prototype, selector.key, {
            value: function (...args: any[]) {
              const deps = getMeta("deps", this, selector.key) as Map<any, any>
              const argKey = JSON.stringify(args)
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
              const cache = getMeta("cache", this, selector.key) as Map<any, any> ?? new Map()
              if (changed) {
                const deps = new Map()
                const result = runInContext(deps, () => value.apply(selector.config.track ? createProxy(this) : this, args))
                cache.set(argKey, result)
                setMeta("deps", deps, this, selector.key)
              } else if (!cache.has(argKey)) {
                const result = value.apply(this, args)
                cache.set(argKey, result)
              }
              setMeta("cache", cache, this, selector.key)
              return cache.get(argKey)
            }
          })
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

    wrap(prototype, "ngOnDestroy", function (fn) {
      const injector = getMetaKeys(INJECTOR, this) as Map<any, EnvironmentInjector>
      for (const meta of injector.values()) {
        meta.destroy()
      }
      fn.apply(this)
    })

    for (const action of actions) {
      wrap(prototype, action.key, function (fn, ...args) {
        const deps = new Map()
        const injector = getMeta(INJECTOR, this, action.key) as EnvironmentInjector
        const dispatcher = injector.get(Dispatcher)
        try {
          const result = injector.runInContext(() => runInContext(deps, fn, action.config.track ? createProxy(this, deps) : this, ...args))
          setMeta("deps", deps, this, action.key)
          dispatcher.dispatch(this, action.key, args, result)
          return result
        } catch (e) {
          handleError(e, injector.get(ErrorHandler), this)
        }
      })
    }
  }
}

function handleError(error: unknown, defaultHandler: ErrorHandler, thisArg: any) {
  const errorHandlers = Array.from(getMetaKeys(Caught, Object.getPrototypeOf(thisArg)).values()) as ActionMeta[]
  for (const handler of errorHandlers) {
    try {
      return handler.method.call(thisArg, error)
    } catch(e) {
      error = e
    }
  }
  defaultHandler.handleError(error)
}

const defaultConfig = {
  track: true,
  check: true,
  immediate: true
}

export interface DispatchEvent<K = PropertyKey, T = unknown> {
  readonly name: K
  readonly context: object
  readonly value: T
  readonly type: ActionType.Dispatch
}

export interface NextEvent<K = PropertyKey, T = unknown> {
  readonly name: K
  readonly context: object
  readonly value: T
  readonly type: ActionType.Next
}

export interface ErrorEvent<K = PropertyKey> {
  readonly name: K
  readonly context: object
  readonly error: unknown
  readonly tries: number
  readonly type: ActionType.Error
}

export interface CompleteEvent<K = PropertyKey> {
  readonly name: K
  readonly context: object
  readonly type: ActionType.Complete
}

export type EventType<ActionKey = PropertyKey, ActionType = unknown, EffectType = unknown> =
  | DispatchEvent<ActionKey, ActionType>
  | NextEvent<ActionKey, EffectType>
  | ErrorEvent<ActionKey>
  | CompleteEvent<ActionKey>

export const DISPATCHER = new InjectionToken("Dispatcher", {
  factory() {
    return new Subject<EventType>()
  }
})

export function Action(config: ActionConfig = defaultConfig) {
  return function (target: object, key: PropertyKey, descriptor: PropertyDescriptor) {
    setMeta(Action, { method: descriptor.value, key, config: { ...defaultConfig, ...config }}, target, key)
  }
}

export function Select(config: ActionConfig = defaultConfig) {
  return function (target: object, key: PropertyKey, descriptor: PropertyDescriptor) {
    setMeta(Select, { descriptor, key, config: { ...defaultConfig, ...config }}, target, key)
  }
}

export function Caught() {
  return function (target: object, key: PropertyKey, descriptor: PropertyDescriptor) {
    setMeta(Caught, { method: descriptor.value, key, config: {}}, target, key)
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

export function createDispatch<T>(token: Type<T>) {
  return function dispatch<U>(source: Observable<U>, observer?: Partial<Observer<T, U>>): Observable<U> {
    const instance = inject(token)
    return new Observable(subscriber => {
      return source.subscribe({
        next(value) {
          try {
            observer?.next?.call(instance, value)
          } catch (e) {
            this.error?.(e)
          }
          subscriber.next(value)
        },
        error(error: unknown) {
          if (observer?.error) {
            try {
              observer?.error?.call(instance, error)
            } catch (e) {
              subscriber.error(e)
            }
          } else {
            subscriber.error(error)
          }
        },
        complete() {
          try {
            observer?.complete?.call(instance)
            subscriber.complete()
          } catch (e) {
            this.error?.(e)
          }
        }
      })
    })
  }
}

export function createEffect<T>(source: Observable<T>, operator: OperatorFunction<ObservableInput<T>, T>): Observable<T> {
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

export function fromAction<T extends object>(token: Type<T>): Observable<ExtractEvents<T, keyof T>> {
  const context = inject(token)
  const dispatcher = inject(DISPATCHER)
  return dispatcher.pipe(
    filter(event => event.context === context)
  ) as Observable<ExtractEvents<T, keyof T>>
}
