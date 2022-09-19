import {
   AfterViewInit,
   ChangeDetectorRef,
   createEnvironmentInjector,
   Directive,
   ElementRef,
   EnvironmentInjector, ErrorHandler,
   inject,
   Injectable,
   InjectionToken,
   Injector,
   INJECTOR,
   Input,
   OnChanges,
   OnDestroy,
   ProviderToken,
   SimpleChanges,
   ViewRef
} from "@angular/core";
import {createProxy, popStack, pushStack, track, untrack} from "./proxy";
import {Observable, ObservableInput, OperatorFunction, PartialObserver, Subject} from "rxjs";
import {
   action, getActions,
   getDeps, getErrorHandlers,
   getMeta,
   getMetaValues, getSelectors,
   getToken, injector,
   markDirty,
   meta, selector,
   setMeta, tracked
} from "./metadata";
import {ActionType, EventType} from "./interfaces";
import {call, dispatch, getId, wrap} from "./utils";

const defaults = { track: true, immediate: true }

function createDecorator(symbol: symbol, defaults = {}) {
   return function decorate(options: {}) {
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

export const Action = createDecorator(action)

export const Invoke = createDecorator(action, { ...defaults, phase: "ngDoCheck" })

export const Before = createDecorator(action, { ...defaults, phase: "ngAfterContentChecked" })

export const Layout = createDecorator(action, { ...defaults, phase: "ngAfterViewChecked" })

export const Select = createDecorator(selector)

export const Caught = createDecorator(selector)

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
   wrap(target, name, function (fn) {
      const effect = getToken(EffectScheduler, this)
      const events = getToken(EventScheduler, this)
      for (const action of actions) {
         const deps = getDeps(this, action.key)
         const dirty = deps && checkDeps(deps)
         if (action.immediate && action.phase === name || dirty) {
            markDirty(this)
            call(this, action.key)
         }
      }
      effect.dequeue()
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

@Injectable()
export class ActionErrorHandler implements ErrorHandler {
   handleError(error: unknown) {
      const errorHandlers = getErrorHandlers(this.target)
      for (const handler of errorHandlers) {
         try {
            return handler.descriptor.value.call(this.injector.get(this.target), error)
         } catch (e) {
            error = e
         }
      }
      this.parent.handleError(error)
   }

   constructor(private target: any, private injector: EnvironmentInjector, private parent: ErrorHandler) {}
}

function decorateFactory(target: {}) {
   wrap(target, "ɵfac", function (fn, ...args) {
      const instance = fn(...args)
      const parent = inject(INJECTOR) as EnvironmentInjector
      const errorHandler = new ActionErrorHandler(target, parent, parent.get(ErrorHandler))
      const storeInjector = createEnvironmentInjector([EventScheduler, { provide: ErrorHandler, useValue: errorHandler }], parent)
      setMeta(injector, storeInjector, instance)
      for (const action of getActions(target)) {
         const childInjector = createEnvironmentInjector([{ provide: ACTION, useValue: action }, EffectScheduler], storeInjector)
         setMeta(injector, childInjector, instance, action.key)
      }
      return instance
   })
}

export function runInContext<T extends (...args: any) => any>(deps: DepMap, fn: T, context = {}, ...args: Parameters<T>) {
   const injector = getToken(EnvironmentInjector, context)
   pushStack(deps)
   try {
      return injector.runInContext(() => fn.apply(context, args))
   } finally {
      popStack()
   }
}

function decorateActions(target: {}) {
   for (const { key } of getActions(target)) {
      wrap(target, key, function (fn, ...args) {
         const proxy = createProxy(this)
         const deps = new Map()
         const value = runInContext(deps, fn, proxy, ...args)
         setMeta(tracked, deps, this, key)
         dispatch(ActionType.Dispatch, this, key, value)
         return value
      })
   }
}

function decorateSelectors(target: {}) {
   for (const { key } of getSelectors(target)) {
      wrap(target, key, function (fn, ...args) {
         const proxy = createProxy(this)
         const deps = new Map()
         const dirty = deps ? checkDeps(deps) : true
         const cacheKey = JSON.stringify(args)
         const cacheValue = getMeta(cacheKey, this, key)
         const result = dirty ? runInContext(deps, fn, proxy, ...args) : cacheValue
         setMeta(cacheKey, result, this, key)
         setMeta(tracked, deps, this, key)
         return result
      })
   }
}

function decorateChanges(target: {}) {
   wrap(target, "ngOnChanges", function (fn, changes) {
      const events = getToken(EventScheduler, this)
      events.push({
         id: getId(),
         name: "ngOnChanges",
         context: this,
         type: ActionType.Dispatch,
         value: changes,
         timestamp: Date.now()
      })
      fn.apply(this)
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

@Injectable()
export class EffectScheduler {
   source = new Subject<Observable<any>>()
   queue: Observable<any>[] = []
   operator!: OperatorFunction<ObservableInput<any>, any>
   destination!: Subject<any>
   connected = false

   next(source: Observable<any>) {
      if (!this.connected) {
         this.connect()
      }
      this.source.next(source)
   }

   enqueue(source: Observable<any>, operator: any) {
      this.operator = operator
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
