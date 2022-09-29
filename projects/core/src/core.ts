import {
   createEnvironmentInjector,
   EnvironmentInjector,
   ErrorHandler,
   inject,
   Injectable,
   InjectionToken,
   INJECTOR,
   NgModule, Provider, Type
} from "@angular/core";
import {createProxy, popStack, pushStack, untrack} from "./proxy";
import {
   filter,
   Observable,
   ObservableInput,
   OperatorFunction,
   Subject,
   Subscription,
   switchAll
} from "rxjs";
import {
   action,
   caught,
   getActions,
   getDeps,
   getErrorHandlers,
   getMeta,
   getMetaValues,
   getSelectors,
   getToken,
   injector,
   markDirty,
   selector,
   setMeta,
   tracked
} from "./metadata";
import {EventType, StoreEvent} from "./interfaces";
import {call, getId, wrap} from "./utils";

const defaults = { track: true, immediate: true }

function createDecorator<T extends {}>(symbol: symbol, defaults = {}) {
   return function decorate(options?: T) {
      return function (target: {}, key: PropertyKey, descriptor?: PropertyDescriptor) {
         setMeta(symbol, { ...defaults, ...options, key, descriptor }, target, key)
      }
   }
}

export const enum Phase {
   DoCheck = "ngDoCheck",
   AfterContentChecked = "ngAfterContentChecked",
   AfterViewChecked = "ngAfterViewChecked"
}

export type DepMap = Map<Record<any, any>, Map<string, unknown>>

export interface ActionMetadata {
   key: string
   descriptor: PropertyDescriptor
   immediate?: boolean;
   phase?: Phase
   track?: boolean
}

export interface SelectMetadata {
   key: string
   descriptor: PropertyDescriptor
}

export interface CaughtMetadata {
   key: string
   descriptor: PropertyDescriptor
}

export const Action = createDecorator<ActionMetadata>(action, { phase: "ngDoCheck" })

export const Invoke = createDecorator<ActionMetadata>(action, { ...defaults, phase: "ngDoCheck" })

export const Before = createDecorator<ActionMetadata>(action, { ...defaults, phase: "ngAfterContentChecked" })

export const Layout = createDecorator<ActionMetadata>(action, { ...defaults, phase: "ngAfterViewChecked" })

export const Select = createDecorator<SelectMetadata>(selector)

export const Caught = createDecorator(caught)

function checkDeps(deps: DepMap) {
   let dirty = false
   for (const [object, keyValues] of deps) {
      for (const [key, previous] of keyValues) {
         const current = object[key]
         if (current !== previous) {
            keyValues.set(key, current)
            dirty = true
         }
      }
   }
   return dirty
}

function decorateCheck(target: {}, name: Phase) {
   const actions = getActions(target, name)
   if (actions.length === 0 && !("ngOnChanges" in target)) return
   wrap(target, name, function (fn) {
      const events = getToken(EventScheduler, this)
      for (const action of actions) {
         if (action.track) {
            const deps = getDeps(this, action.key)
            const dirty = deps && checkDeps(deps)
            if (action.descriptor.value.length === 0 && (!deps && action.immediate && action.phase === name || dirty)) {
               markDirty(this)
               call(this, action.key)
            }
         }
      }
      for (const action of actions) {
         const effect = getToken(EffectScheduler, this, action.key)
         effect.dequeue()
      }
      events.flush()
      fn.apply(this)
   })
}

export const ACTION = new InjectionToken<ActionMetadata>("ACTION")
export const CONTEXT = new InjectionToken<{ instance: unknown }>("CONTEXT")

export const EVENTS = new InjectionToken("EVENTS", {
   factory() {
      return new Subject<StoreEvent>()
   }
})

type ExtractEvents<T, U extends PropertyKey> = {
   [key in U]: key extends keyof T ? T[key] extends (...params: infer P) => infer R ? StoreEvent<key, P, R> : never : never
}[U]

export function fromStore<T>(type: Type<T>): Observable<ExtractEvents<T, keyof T>>
export function fromStore<T>(type: T): Observable<ExtractEvents<T, keyof T>>
export function fromStore(type: Type<any>): Observable<ExtractEvents<any, any>> {
   const instance = typeof type === "function" ? inject(type) : type
   return inject(EVENTS).pipe(
      filter(event => event.context === instance)
   ) as any
}

interface StoreConfig {
   root?: boolean
   actionProviders?: Provider[]
}

const STORE_CONFIG = new InjectionToken<StoreConfig>("STORE_CONFIG")
const ROOT_CONFIG = new InjectionToken<StoreConfig>("ROOT_CONFIG", {
   factory() {
      return {}
   }
})

export function configureStore(config: StoreConfig) {
   return {
      provide: config.root ? ROOT_CONFIG : STORE_CONFIG,
      useValue: config
   }
}

export class StoreErrorHandler implements ErrorHandler {
   handleError(error: unknown) {
      const errorHandlers = getErrorHandlers(this.prototype)
      for (const handler of errorHandlers) {
         try {
            return handler.descriptor.value.call(this.instance, error)
         } catch (e) {
            error = e
         }
      }
      throw error
   }

   constructor(private prototype: any, private instance: {}) {}
}

function getConfig() {
   return inject(STORE_CONFIG, { self: true, optional: true }) ?? inject(ROOT_CONFIG)
}

function setup(instance: {}, target: Function) {
   if (getMeta(injector, instance)) return
   const prototype = target.prototype
   const parent = inject(INJECTOR) as EnvironmentInjector
   const errorHandler = new StoreErrorHandler(prototype, instance)
   const storeInjector = createEnvironmentInjector([EventScheduler, { provide: ErrorHandler, useValue: errorHandler }], parent)
   let storeConfig = getConfig()
   setMeta(injector, storeInjector, instance)
   for (const action of getActions(prototype)) {
      const actionInjector = createEnvironmentInjector([{ provide: ACTION, useValue: action }, { provide: CONTEXT, useValue: {instance} }, EffectScheduler, storeConfig?.actionProviders ?? []], storeInjector)
      setMeta(injector, actionInjector, instance, action.key)
   }
}

export const stores = new Set<any>()
const decorated = new WeakSet()

export function decorateFactory(target: any) {
   stores.add(target)
   if (Object.getOwnPropertyDescriptor(target, "ɵfac")?.value && !decorated.has(target)) {
      decorated.add(target)
      wrap(target, "ɵfac", function (fn, ...args) {
         const instance = fn(...args)
         setup(instance, target)
         return instance
      })
   }
}

export function runInContext<T extends (...args: any) => any>(deps: DepMap, fn: T, context = {}, key?: string, ...args: Parameters<T>) {
   const injector = getToken(EnvironmentInjector, untrack(context), key)
   const errorHandler = injector.get(ErrorHandler)
   pushStack(deps)
   try {
      return injector.runInContext(() => fn.apply(context, args))
   } catch (e) {
      errorHandler.handleError(e)
   } finally {
      popStack()
   }
}

function runAction(this: any, fn: any, key: any, ...args: any[]) {
   const event = inject(EventScheduler)
   event.schedule(EventType.Dispatch, untrack(this), key, args)
   return fn.apply(this, args)
}

function decorateActions(target: {}) {
   for (const { key } of getActions(target)) {
      wrap(target, key, function (fn, ...args) {
         const proxy = createProxy(this)
         const deps = new Map()
         setMeta(tracked, deps, this, key)
         return runInContext(deps, runAction, proxy, key, fn, key, ...args)
      })
   }
}

function decorateSelectors(target: {}) {
   for (const { key } of getSelectors(target)) {
      wrap(target, key, function (fn, ...args) {
         const cacheKey = key + JSON.stringify(args)
         const proxy = createProxy(this)
         const deps = getDeps(this, cacheKey)
         const dirty = deps ? checkDeps(deps) : true
         let result = getMeta(cacheKey, this, key)
         if (dirty) {
            const newDeps = new Map()
            result = runInContext(newDeps, fn, proxy, void 0, ...args)
            setMeta(cacheKey, result, this, key)
            setMeta(tracked, newDeps, this, cacheKey)
         }
         return result
      })
   }
}

function decorateChanges(target: {}) {
   wrap(target, "ngOnChanges", function (fn, changes) {
      const events = getToken(EventScheduler, this)
      events.schedule(EventType.Dispatch, this, "ngOnChanges", changes)
      fn.call(this, changes)
   })
}

function decorateDestroy(target: {}) {
   wrap(target, "ngOnDestroy", function (fn) {
      for (const environmentInjector of getMetaValues<EnvironmentInjector>(injector, this)) {
         environmentInjector.destroy()
      }
      fn.apply(this)
   })
}

export function Store() {
   return function (target: Function) {
      const { prototype } = target

      decorateFactory(target)
      decorateChanges(prototype)
      decorateDestroy(prototype)

      decorateCheck(prototype, Phase.DoCheck)
      decorateCheck(prototype, Phase.AfterContentChecked)
      decorateCheck(prototype, Phase.AfterViewChecked)

      decorateActions(prototype)
      decorateSelectors(prototype)
   }
}

@Injectable()
export class EventScheduler {
   events: StoreEvent[] = []
   dispatcher = inject(EVENTS)

   schedule(type: EventType, context: {}, name: string, value: unknown) {
      this.events.push({
         id: getId(),
         timestamp: Date.now(),
         type,
         context,
         name,
         value,
      } as StoreEvent)
   }

   flush() {
      let event
      while (event = this.events.shift()) {
         this.dispatcher.next(event)
      }
   }
}

@Injectable()
export class EffectScheduler {
   source = new Subject<Observable<any>>()
   queue: Observable<any>[] = []
   operator?: OperatorFunction<ObservableInput<any>, any>
   destination!: Subject<any>
   connected = false
   subscription = Subscription.EMPTY
   pending = new Set

   next(source: Observable<any>) {
      if (!this.connected) {
         this.connect()
      }
      this.source.next(source)
   }

   enqueue(source: Observable<any>) {
      this.queue.push(source)
   }

   dequeue() {
      let source
      if (this.pending.size === 0) {
         while (source = this.queue.shift()) {
            this.next(source)
         }
      }
   }

   connect() {
      this.connected = true
      this.destination = new Subject()
      this.subscription = this.source.pipe(this.operator ?? switchAll()).subscribe(this.destination)
      this.subscription.add(() => this.connected = false)
   }

   addPending(promise: Promise<any>) {
      this.pending.add(promise)
      promise.finally(() => {
         this.pending.delete(promise)
         this.dequeue()
      })
   }

   ngOnDestroy() {
      this.subscription.unsubscribe()
   }
}
