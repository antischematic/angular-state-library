import {
   ChangeDetectorRef,
   createEnvironmentInjector, EnvironmentInjector,
   ErrorHandler, EventEmitter,
   inject,
   Injectable, InjectionToken, INJECTOR, NgZone, Type,

} from "@angular/core";
import {
   BehaviorSubject,
   catchError, dematerialize,
   EMPTY, filter, materialize,
   MonoTypeOperatorFunction,
   Observable, ObservableInput, ObservableNotification, OperatorFunction,
   PartialObserver,
   Subject,
   Subscription, tap
} from "rxjs";
import {createProxy, runInContext} from "./proxy";
import {createTransitionZone} from "./transition";

const meta = new WeakMap()

const noop = () => {
}

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

type QueueMeta = { key: PropertyKey, descriptor: PropertyDescriptor, action?: string, config: {} }

function wrap(target: { [key: PropertyKey]: any }, key: PropertyKey, fn: (this: any, ...args: any[]) => any) {
   const originalFunction = target[key] ?? noop
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
            let changed = false
            if (deps) {
               for (const [object, keyValue] of deps) {
                  for (const [key, previous] of keyValue) {
                     const current = object[key]
                     if (current !== previous) {
                        // update deps in case of error, so it doesn't automatically run until the value
                        // changes again
                        keyValue.set(key, current)
                        changed = true
                     }
                  }
               }
            }
            if (!deps && action.config.immediate && action.method.length === 0 || changed) {
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
   source = new Subject<Observable<any>>()
   destination = new Subject()
   subscription = Subscription.EMPTY
   observer = Subscription.EMPTY
   connected = false

   next(source: Observable<any>) {
      this.source.next(source)
   }

   subscribe(observer: PartialObserver<any>) {
      this.observer.unsubscribe()
      this.observer = this.destination.subscribe(observer)
      if (!this.connected) {
         this.connected = true
         this.source = new Subject()
         this.destination = new Subject()
         this.observer = this.destination.subscribe(observer)
         this.subscription = this.source.pipe(this.operator).subscribe(this.destination)
      }
      return Subscription.EMPTY
   }

   ngOnDestroy() {
      this.observer.unsubscribe()
      this.subscription.unsubscribe()
   }
}

export enum ActionType {
   Dispatch = "dispatch",
   Next = "next",
   Error = "error",
   Complete = "complete"
}

@Injectable()
export class Dispatcher {
   name!: PropertyKey
   context!: object
   tries = 1
   events = inject(Events)
   errorHandler = inject(ErrorHandler)
   subscription = Subscription.EMPTY
   effect: Function | null = null

   dispatch(type: ActionType, value?: any) {
      const {events, context, name} = this
      const event = {
         name,
         context,
         type,
      } as any
      switch (type) {
         case ActionType.Dispatch:
         case ActionType.Next:
            event.value = value
            break
         case ActionType.Error:
            event.error = value
      }
      events.push(event)
   }

   connect() {
      const {effect} = this
      if (effect) {
         this.effect = null
         this.subscription.unsubscribe()
         this.subscription = effect({
            error: (error: any) => {
               handleError(error, this.errorHandler, Object.getPrototypeOf(this.context), this.context)
            }
         })
      }
   }

   ngOnDestroy() {
      this.subscription.unsubscribe()
   }
}

@Injectable()
class Events {
   events = [] as EventType[]
   dispatcher = inject(DISPATCHER)

   push(event: EventType) {
      this.events.push(event)
   }

   flush() {
      let event
      while (event = this.events.shift()) {
         this.dispatcher.next(event)
      }
   }
}

export function setup(context: any, prototype: object) {
   const parent = inject(INJECTOR)
   const count = new Subject<number>()
   const rootInjector = createEnvironmentInjector([Events, { provide: TransitionZone, useFactory: () => createTransitionZone(prototype.constructor.name, count)}], parent as EnvironmentInjector)
   const actions = Array.from(getMetaKeys(Action, prototype).values()) as ActionMeta[]
   const queues = Array.from(getMetaKeys(Queue, prototype).values()) as QueueMeta[]
   const changeDetector = inject(ChangeDetectorRef)
   const rootQueues = queues.filter(q => q.action === undefined)

   count.subscribe((value) => {
      for (const queue of rootQueues) {
         context[queue.key] = typeof context[queue.key] === "number" ? value : value > 0
      }
      changeDetector.detectChanges()
   })

   setMeta(INJECTOR, rootInjector, context)
   for (const action of actions) {
      const injector = createEnvironmentInjector([{
         provide: Dispatcher,
         useFactory: () => {
            const dispatcher = new Dispatcher()
            dispatcher.name = action.key
            dispatcher.context = context
            return dispatcher
         }
      }, Effect], rootInjector)
      setMeta(INJECTOR, injector, context, action.key)
   }
}

const TransitionZone = new InjectionToken<Function>("TransitionZone")

export function Store() {
   return function (target: any) {
      const {prototype} = target
      const selectors = Array.from(getMetaKeys(Select, prototype).values()) as SelectMeta[]
      const actions = Array.from(getMetaKeys(Action, prototype).values()) as ActionMeta[]
      const checkActions = actions.filter((action) => action.config.check)
      const contentActions = actions.filter((action) => action.config.content)
      const viewActions = actions.filter((action) => action.config.view)

      decorateLifecycleHook(prototype, "ngDoCheck", checkActions)
      decorateLifecycleHook(prototype, "ngAfterContentChecked", contentActions)
      decorateLifecycleHook(prototype, "ngAfterViewChecked", viewActions)

      wrap(target, 'ɵfac', function (factory) {
         const instance = factory()
         setup(instance, prototype)
         return instance
      })

      if (selectors.length) {
         for (const selector of selectors) {
            const {get, value} = selector.descriptor
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
         (getMeta(INJECTOR, this) as EnvironmentInjector).get(Events).flush()
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
            const startTransition = injector.get(TransitionZone)

            try {
               dispatcher.dispatch(ActionType.Dispatch, args)
               const result: any = injector.runInContext(() => runInContext(deps, () => startTransition(() => fn.apply(action.config.track ? createProxy(this) : this, args))))
               setMeta("deps", deps, this, action.key)
               if (result) {
                  dispatcher.effect = (observer: any) => startTransition(() => result.subscribe(observer))
               }
               return result
            } catch (e) {
               handleError(e, injector.get(ErrorHandler), prototype, this)
            }
         })
      }
   }
}

function handleError(error: unknown, defaultHandler: ErrorHandler, prototype: any, instance: any) {
   const errorHandlers = Array.from(getMetaKeys(Caught, prototype).values()) as ActionMeta[]
   for (const handler of errorHandlers) {
      try {
         return handler.method.call(instance, error)
      } catch (e) {
         error = e
      }
   }
   defaultHandler.handleError(error)
}

const defaultConfig = {
   check: true,
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
      setMeta(Action, {
         method: descriptor.value,
         key,
         config: {...defaultConfig, ...config}
      }, target, key)
   }
}

export function Invoke(config?: ActionConfig) {
   return Action({immediate: true, track: true, ...config})
}

export function Before(config?: ActionConfig) {
   return Invoke({check: false, content: true, ...config})
}

export function Layout(config?: ActionConfig) {
   return Invoke({check: false, view: true, ...config})
}

export function Select(config: ActionConfig = defaultConfig) {
   return function (target: object, key: PropertyKey, descriptor: PropertyDescriptor) {
      setMeta(Select, {
         descriptor,
         key,
         config: {...defaultConfig, track: true, ...config}
      }, target, key)
   }
}

export function Caught() {
   return function (target: object, key: PropertyKey, descriptor: PropertyDescriptor) {
      setMeta(Caught, {method: descriptor.value, key, config: {}}, target, key)
   }
}

export function Queue(action?: PropertyKey, config = {}) {
   return function (target: object, key: PropertyKey) {
      setMeta(Queue, {key, action, config}, target, key)
   }
}

interface Observer<This, Value> {
   next(this: This, value: Value): void

   error(this: This, error: unknown): void

   complete(this: This): void

   finalize(this: This): void
}

function isPlainObject(obj: object) {
   const proto = Object.getPrototypeOf(obj)
   return proto === null || proto === Object.prototype
}

function createObserver(observer: any, context: any, onError: (error: unknown) => void) {
   const dispatcher = inject(Dispatcher)
   const changeDetector = inject(ChangeDetectorRef)
   const events = inject(Events)
   return function (type: string, subscriber: any) {
      return function (value?: any) {
         try {
            observer?.[type]?.call(context, value)
         } catch (error) {
            onError(error)
         }
         if (type !== ActionType.Error || !observer?.error) {
            subscriber[type](value)
         }
         if (type !== ActionType.Next) {
            observer?.finalize?.call(context, value)
         }
         dispatcher.dispatch(type as ActionType, value)
         events.flush()
         changeDetector.detectChanges()
      }
   }
}

export function createDispatch<T>(token: Type<T>) {
   return function dispatch<U>(source: Observable<U>, observer?: Partial<Observer<T, U>>): Observable<U> {
      const instance = inject(token)
      const context = observer && isPlainObject(observer) ? instance : observer as any
      const errorHandler = inject(ErrorHandler)
      const changeDetector = inject(ChangeDetectorRef)
      const isEffect = source instanceof EffectObservable
      const onError = (error: unknown) => handleError(error, errorHandler, token.prototype, instance)
      const observe = createObserver(observer, context, onError)

      changeDetector.markForCheck()

      return new Observable(subscriber => {
         const next = observe(ActionType.Next, subscriber)
         const error = observe(ActionType.Error, subscriber)
         const complete = observe(ActionType.Complete, subscriber)
         if (isEffect) {
            source.subscribe((notification: any) => {
               switch (notification.kind) {
                  case "N":
                     next(notification.value)
                     break
                  case "E":
                     error(notification.error)
                     break
                  case "C":
                     complete()
                     break
               }
            })
            return
         } else {
            return source.subscribe({
               next,
               error,
               complete
            })
         }
      })
   }
}

class EffectObservable extends Observable<any> {}

export function createEffect<T>(source: Observable<T>, operator: OperatorFunction<ObservableInput<T>, T>): Observable<T> {
   const effect = inject(Effect)
   effect.operator = operator
   return new EffectObservable(subscriber => {
      const subscription = effect.subscribe(subscriber)
      effect.next(source.pipe(materialize()))
      return subscription
   })
}

type ExtractEvents<T, U extends PropertyKey> = {
   [key in U]: key extends keyof T ? T[key] extends (...params: infer P) => Observable<infer R> ? EventType<key, P, R> : never : never
}[U]

export function fromAction<T extends object>(token: Type<T>): Observable<ExtractEvents<T, keyof T>> {
   const context = inject(token)
   const dispatcher = inject(DISPATCHER)
   return dispatcher.pipe(
      filter(event => event.context === context)
   ) as Observable<ExtractEvents<T, keyof T>>
}
