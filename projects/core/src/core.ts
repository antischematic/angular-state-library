import {
   createEnvironmentInjector,
   EnvironmentInjector,
   ErrorHandler,
   inject,
   Injectable,
   InjectionToken,
   INJECTOR,
   NgModule
} from "@angular/core";
import {createProxy, popStack, pushStack, untrack} from "./proxy";
import {Observable, ObservableInput, OperatorFunction, Subject, switchAll} from "rxjs";
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
import {ActionType, EventType} from "./interfaces";
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
   immediate?: boolean;
   phase?: Phase
}

export interface SelectMetadata {
   key: string
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
         const deps = getDeps(this, action.key)
         const dirty = deps && checkDeps(deps)
         if (!deps && action.immediate && action.phase === name || dirty) {
            markDirty(this)
            call(this, action.key)
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

export const DISPATCHER = new InjectionToken("Dispatcher", {
   factory() {
      return new Subject<EventType>()
   }
})

export class ActionErrorHandler implements ErrorHandler {
   handleError(error: unknown) {
      const errorHandlers = getErrorHandlers(this.prototype)
      for (const handler of errorHandlers) {
         try {
            return handler.descriptor.value.call(this.instance, error)
         } catch (e) {
            error = e
         }
      }
      this.parent.handleError(error)
   }

   constructor(private prototype: any, private instance: {}, private parent: ErrorHandler) {}
}

function setup(instance: {}) {
   if (getMeta(injector, instance)) return
   const prototype = Object.getPrototypeOf(instance)
   const parent = inject(INJECTOR) as EnvironmentInjector
   const errorHandler = new ActionErrorHandler(prototype, instance, parent.get(ErrorHandler))
   const storeInjector = createEnvironmentInjector([EventScheduler, { provide: ErrorHandler, useValue: errorHandler }], parent)
   setMeta(injector, storeInjector, instance)
   for (const action of getActions(prototype)) {
      const childInjector = createEnvironmentInjector([{ provide: ACTION, useValue: action }, EffectScheduler], storeInjector)
      setMeta(injector, childInjector, instance, action.key)
   }
}

export function processStores() {
   for (const store of stores) {
      Object.defineProperty(store, "ɵfac", {configurable: true, value: store["ɵfac"]})
      decorateFactory(store)
   }
}

@NgModule()
export class StoreTestingModule {
   constructor() {
      processStores()
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
         setup(instance)
         return instance
      })
   }
}

export function runInContext<T extends (...args: any) => any>(deps: DepMap, fn: T, context = {}, key?: string, ...args: Parameters<T>) {
   const injector = getToken(EnvironmentInjector, untrack(context), key)
   const errorHandler = getToken(ErrorHandler, untrack(context), key)
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
   event.schedule(ActionType.Dispatch, untrack(this), key, args)
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
         const proxy = createProxy(this)
         const deps = getDeps(target, key)
         const dirty = deps ? checkDeps(deps) : true
         const cacheKey = JSON.stringify(args)
         let result = getMeta(cacheKey, this, key)
         if (dirty) {
            const newDeps = new Map()
            result = runInContext(newDeps, fn, proxy, void 0, ...args)
            setMeta(cacheKey, result, this, key)
            setMeta(tracked, newDeps, this, key)
         }
         return result
      })
   }
}

function decorateChanges(target: {}) {
   wrap(target, "ngOnChanges", function (fn, changes) {
      const events = getToken(EventScheduler, this)
      events.schedule(ActionType.Dispatch, this, "ngOnChanges", changes)
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
   events: EventType[] = []
   dispatcher = inject(DISPATCHER)

   schedule(type: ActionType, context: {}, name: string, value: unknown) {
      this.events.push({
         id: getId(),
         timestamp: Date.now(),
         type,
         context,
         name,
         value,
      })
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
   operator: OperatorFunction<ObservableInput<any>, any> = switchAll()
   destination!: Subject<any>
   connected = false

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
      while (source = this.queue.shift()) {
         this.next(source)
      }
   }

   connect() {
      this.connected = true
      this.destination = new Subject()
      this.source.pipe(this.operator).subscribe(this.destination).add(() => this.connected = false)
   }
}
