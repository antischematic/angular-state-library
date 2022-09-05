import {
   ChangeDetectorRef,
   createEnvironmentInjector,
   EnvironmentInjector,
   ErrorHandler,
   inject,
   Injectable,
   InjectionToken, InjectOptions,
   INJECTOR,
   NgZone, ProviderToken, SimpleChanges,
   Type, ViewRef,
} from "@angular/core";
import {
   filter,
   materialize,
   MonoTypeOperatorFunction,
   Observable,
   ObservableInput,
   OperatorFunction,
   Subject,
   Subscription,
   ObservableNotification,
   share,
   tap,
   switchAll,
   mergeAll,
   concatAll,
   exhaustAll
} from "rxjs";
import {createProxy, runInContext, track} from "./proxy";
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

function checkDeps(deps: Map<any, any>, update = true) {
   let changed = false
   if (deps) {
      for (const [object, keyValue] of deps) {
         for (const [key, previous] of keyValue) {
            const current = object[key]
            if (current !== previous) {
               // update deps in case of error, so it doesn't automatically run until the value
               // changes again
               if (update) {
                  keyValue.set(key, current)
               }
               changed = true
            }
         }
      }
   }
   return changed
}

function decorateLifecycleHook(prototype: object, key: string, actions: ActionMeta[], selectors: SelectMeta[]) {
   if (selectors.length) {
      wrap(prototype, key, function (fn) {
         const injector = getMeta(INJECTOR, this) as EnvironmentInjector
         const changeDetector = injector.get(ChangeDetectorRef)
         for (const selector of selectors) {
            const deps = getMeta("deps", this, selector.key) as Map<any, any>
            if (checkDeps(deps, false)) {
               setMeta("dirty", true, this, selector.key)
               changeDetector.markForCheck()
            }
         }
         fn.apply(this)
      })
   }
   if (actions.length) {
      wrap(prototype, key, function (fn) {
         for (const action of actions) {
            const deps = getMeta("deps", this, action.key) as Map<any, any>
            const changed = checkDeps(deps)
            if (!deps && action.config.immediate && action.method.length === 0 || changed) {
               this[action.key].call(this)
            }
         }
         const events = (getMeta(INJECTOR, this) as EnvironmentInjector).get(Events)
         events.dequeue()
         events.flush()
         fn.apply(this)
      })
   }
}


@Injectable()
export class Effect {
   operator!: MonoTypeOperatorFunction<any>
   source = new Subject
   destination = new Subject<ObservableNotification<any>>()
   subscription = Subscription.EMPTY
   connected = false
   observer: any

   next(source: any) {
      this.source.next(source)
   }

   setOperator(operator: any) {
      this.operator = operator
      return this
   }

   connect() {
      if (!this.connected) {
         this.connected = true
         this.subscription = this.source.pipe(this.operator).subscribe(this.destination)
      }
   }

   subscribe(observer?: any) {
      try {
         return this.destination.subscribe(observer)
      } finally {
         this.connect()
      }
   }

   ngOnDestroy() {
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

   queue(effect: any) {
      this.events.queue.push(effect)
   }
}

const tick = Promise.resolve()

@Injectable()
class Events {
   events = [] as EventType[]
   dispatcher = inject(DISPATCHER)
   queue = [] as any[];

   push(event: EventType) {
      this.events.push(event)
   }

   flush() {
      let event
      while (event = this.events.shift()) {
         this.dispatcher.next(event)
      }
   }

   dequeue() {
      let effect
      while (effect = this.queue.shift()) {
         effect({
            error() {}
         })
      }
   }
}

const Changes = new InjectionToken("Changes", {
   factory: createChanges
})

function createChanges() {
   let changes = {}
   return {
      set value(value) {
         changes = value
      },
      get value() {
         return changes
      }
   }
}

export type TypedChanges<T> = {
   readonly [key in keyof T]?: {
      previousValue?: T[key]
      currentValue: T[key]
      firstChange: boolean
      isFirstChange(): boolean
   }
}

export function onChanges<T>(): TypedChanges<T>
export function onChanges(): SimpleChanges
export function onChanges(): SimpleChanges {
   const changes = inject(Changes)
   return track(changes).value
}

export interface StoreConfig {
   deps?: any[]
}

export function dependsOn(...deps: ProviderToken<any>[]) {
   return {
      provide: Store,
      useValue: {
         deps
      }
   }
}

export function setup(context: any, prototype: object = Object.getPrototypeOf(context)) {
   const parent = inject(INJECTOR)
   const count = new Subject<number>()
   const rootInjector = createEnvironmentInjector([Events, { provide: Changes, useFactory: createChanges }, { provide: TransitionZone, useFactory: () => createTransitionZone(prototype.constructor.name, count)}], parent as EnvironmentInjector)
   const actions = Array.from(getMetaKeys(Action, prototype).values()) as ActionMeta[]
   const config = parent.get(Store, { optional: true }) as StoreConfig
   const deps = config?.deps?.map(token => inject(token))

   if (deps) {
      const changeDetector = rootInjector.get(ChangeDetectorRef) as ViewRef
      const subscription = rootInjector.get(DISPATCHER).subscribe((event) => {
         if (changeDetector.destroyed) {
            subscription.unsubscribe()
         } else if (deps.includes(event.context)) {
            changeDetector.markForCheck()
         }
      })
   }

   transitions.set(context, new Set())
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

const transitions = new WeakMap()

export function Store() {
   return function (target: any) {
      const {prototype} = target
      const selectors = Array.from(getMetaKeys(Select, prototype).values()) as SelectMeta[]
      const actions = Array.from(getMetaKeys(Action, prototype).values()) as ActionMeta[]
      const checkActions = actions.filter((action) => action.config.check)
      const contentActions = actions.filter((action) => action.config.content)
      const viewActions = actions.filter((action) => action.config.view)
      const queues = Array.from(getMetaKeys(Queue, prototype).values()) as QueueMeta[]
      const rootQueues = queues.filter(q => q.action === undefined)

      decorateLifecycleHook(prototype, "ngDoCheck", checkActions, selectors)
      decorateLifecycleHook(prototype, "ngAfterContentChecked", contentActions, selectors)
      decorateLifecycleHook(prototype, "ngAfterViewChecked", viewActions, selectors)

      wrap(target, 'ɵfac', function (factory) {
         const instance = factory()
         setup(instance, prototype)
         return instance
      })

      wrap(prototype, "ngOnChanges", function (fn, changes) {
         const injector = getMeta(INJECTOR, this) as EnvironmentInjector
         injector.get(Changes).value = changes
         injector.get(Events).push({
            name: "ngOnChanges",
            context: this,
            type: ActionType.Dispatch,
            value: changes
         })
         fn.apply(this)
      })

      if (selectors.length) {
         for (const selector of selectors) {
            const { get, value = get } = selector.descriptor
            Object.defineProperty(prototype, selector.key, {
               [get ? "get" : "value"]: function (...args: any[]) {
                  const deps = getMeta("deps", this, selector.key) as Map<any, any>
                  const changed = checkDeps(deps, false) || !deps
                  const argKey = JSON.stringify(args)
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
         }
      }

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
            const count = new Subject<number>()
            const startTransition = createTransitionZone(action.key, count)
            const changeDetector = injector.get(ChangeDetectorRef)
            const ngZone = injector.get(NgZone)
            let current: Zone
            const transition = transitions.get(this)! as Set<any>

            changeDetector.markForCheck()

            // todo: find a better way to coalesce transitions
            // probably causes a bunch of memory leaks
            count.subscribe((value) => {
               if (value) {
                  transition.add(count)
               } else {
                  if (transition.has(count)) {
                     count.complete()
                  }
                  transition.delete(count)
               }
               for (const queue of rootQueues) {
                  this[queue.key] = transition.size
               }
               Zone.root.run(() => {
                  tick.then(() => {
                     ngZone.run(() => {
                        changeDetector.markForCheck()
                     })
                  })
               })
            })

            try {
               dispatcher.dispatch(ActionType.Dispatch, args)
               const result: any = injector.runInContext(() => runInContext(deps, () => {
                  return startTransition(() => {
                     current = Zone.current
                     return fn.apply(action.config.track ? createProxy(this) : this, args)
                  })
               }))
               setMeta("deps", deps, this, action.key)
               dispatcher.queue((observer: any) => current.run(() => {
                  let subscription = Subscription.EMPTY
                  if (result) {
                     subscription = result.subscribe(observer)
                  }
                  return subscription
               }))
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
   return function (type: string) {
      return function (value?: any) {
         dispatcher.dispatch(type as ActionType, value)
         try {
            observer?.[type]?.call(context, value)
         } catch (error) {
            onError(error)
         }
         if (type === ActionType.Error && !observer?.error) {
            onError(value)
         }
         if (type !== ActionType.Next) {
            observer?.finalize?.call(context, value)
         }
         events.flush()
         changeDetector.markForCheck()
      }
   }
}

export function createDispatch<T>(token: Type<T>) {
   return function dispatch<U>(source: Observable<U>, observer?: Partial<Observer<T, U>>): Observable<U> {
      const instance = inject(token)
      const context = observer && isPlainObject(observer) ? instance : observer as any
      const errorHandler = inject(ErrorHandler)
      const onError = (error: unknown) => handleError(error, errorHandler, token.prototype, instance)
      const observe = createObserver(observer, context, onError)

      const effect = source instanceof EffectObservable || source instanceof LoadEffect ? source : new EffectObservable(source, switchAll())

      effect.observer = {
         next: observe(ActionType.Next),
         error: observe(ActionType.Error),
         complete: observe(ActionType.Complete),
      }
      effect.effect = inject(Effect)

      return effect.pipe(share())
   }
}

class EffectObservable extends Observable<any> {
   observer: any
   effect!: Effect

   constructor(source: any, operator: any) {
      super((subscriber) => {
         if (this.observer) {
            const subscription = this.effect.setOperator(operator).subscribe()
            this.effect.next(source.pipe(tap(this.observer), tap(subscriber), materialize()))
            subscriber.add(subscription)
         } else {
            return source.subscribe(subscriber)
         }
         return subscriber

      })
   }
}

export function createEffect<T>(source: Observable<T>, operator: OperatorFunction<ObservableInput<T>, T>): Observable<T> {
   return new EffectObservable(source, operator)
}

export function mergeEffect<T>(source: Observable<T>, concurrent?: number): Observable<T> {
   return createEffect(source, mergeAll(concurrent))
}

export function concatEffect<T>(source: Observable<T>): Observable<T> {
   return createEffect(source, concatAll())
}

export function exhaustEffect<T>(source: Observable<T>): Observable<T> {
   return createEffect(source, exhaustAll())
}

class LoadEffect extends Observable<any> {
   observer: any
   effect: any
   constructor(fn: any, injector: any, args: any) {
      super(subscriber => {
         fn().then((mod: any) => {
            let source = injector.runInContext(() => mod.default(...args))
            source = source instanceof  EffectObservable ? source : new EffectObservable(source, switchAll())
            source.effect = this.effect
            source.observer = this.observer
            subscriber.add(source.subscribe(subscriber))
         })
         return subscriber
      });
   }
}

export function loadEffect<Args extends any[], Result extends Observable<any>>(
   fn: () => Promise<{ default(...args: Args): Result }>
) {
   return function (...args: Args) {
      // transition workaround
      setTimeout(() => {}, 0);
      const injector = inject(EnvironmentInjector);
      return new LoadEffect(fn, injector, args);
   }
}

type ExtractEvents<T, U extends PropertyKey> = {
   [key in U]: key extends keyof T ? T[key] extends (...params: infer P) => Observable<infer R> ? EventType<key, P, R> : never : never
}[U]

export function fromStore<T extends Type<any>>(token: T, options?: InjectOptions): Observable<ExtractEvents<InstanceType<T>, keyof InstanceType<T>>>
export function fromStore<T extends object>(store: T): Observable<ExtractEvents<T, keyof T>>
export function fromStore(token: unknown, options?: InjectOptions): Observable<EventType> {
   const context = typeof token === "function" ? inject(token, options ?? {}) : token
   const dispatcher = inject(DISPATCHER)
   return dispatcher.pipe(
      filter(event => event.context === context)
   )
}
