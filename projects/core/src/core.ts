import {
   AfterViewInit,
   ChangeDetectorRef,
   createEnvironmentInjector,
   Directive,
   ElementRef,
   EnvironmentInjector,
   inject, Injectable,
   InjectionToken,
   Injector,
   INJECTOR, Input, OnChanges, OnDestroy,
   ProviderToken, SimpleChange, SimpleChanges,
   ViewRef
} from "@angular/core";
import {createProxy, popStack, pushStack, track, untrack} from "./proxy";
import {Observable, ObservableInput, OperatorFunction, PartialObserver, Subject, tap} from "rxjs";
import {getMeta, getMetaValues, meta, setMeta} from "./metadata";
import {ActionType, Dispatch, EventType} from "./interfaces";
import {getMetaKeys} from "./actions";

const defaults = { track: true, immediate: true }

function createDecorator(symbol: symbol, defaults = {}) {
   return function decorate(options: {}) {
      return function (target: {}, key: PropertyKey, descriptor?: PropertyDescriptor) {
         setMeta(symbol, { ...defaults, ...options, key, descriptor }, target, key)
      }
   }
}

const enum Phase {
   DoCheck = "ngDoCheck",
   AfterContentChecked = "ngAfterContentChecked",
   AfterViewChecked = "ngAfterViewChecked"
}

const action = Symbol("action")
const selector = Symbol("selector")
const tracked = Symbol("track")
const injector = Symbol("injector")

type DepMap = Map<Record<any, any>, Map<string, unknown>>

interface ActionMetadata {
   immediate: boolean;
   key: string
   phase: Phase
}

interface SelectMetadata {
   key: string
}

export const Action = createDecorator(action)

export const Invoke = createDecorator(action, { ...defaults, phase: "ngDoCheck" })

export const Before = createDecorator(action, { ...defaults, phase: "ngAfterContentChecked" })

export const Layout = createDecorator(action, { ...defaults, phase: "ngAfterViewChecked" })

export const Select = createDecorator(selector)

function noop() {}

function getActions(target: {}, phase?: Phase) {
   return getMetaValues<ActionMetadata>(action, target).filter(meta => phase ? meta.phase === phase : true)
}

function getSelectors(target:{}) {
   return getMetaValues<SelectMetadata>(selector, target)
}

function getDeps(target: {}, key: PropertyKey): DepMap | undefined {
   return getMeta(tracked, target, key)
}

function getToken<T>(token: ProviderToken<T>, context: {}): T {
   return getMeta<Injector>(injector, context)!.get(token)
}

function markDirty(context: {}) {
   getToken(ChangeDetectorRef, context).markForCheck()
}

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

function call(target: Record<any, any>, key: string, ...args: any[]) {
   return target[key].apply(target, args)
}

function wrap(target: { [key: PropertyKey]: any }, key: PropertyKey, fn: (this: any, ...args: any[]) => any) {
   const originalFunction = target[key] ?? noop
   Object.defineProperty(target, key, {
      configurable: true,
      value: function (this: unknown, ...args: any[]) {
         return fn.call(untrack(this), originalFunction, ...args)
      }
   })
}

function decorateCheck(target: {}, name: Phase) {
   const actions = getActions(target, name)
   wrap(target, name, function (fn) {
      const effect = getToken(Effect, this)
      const events = getToken(Events, this)
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

function decorateFactory(target: {}) {
   wrap(target, "ɵfac", function (fn, ...args) {
      const instance = fn(...args)
      const parent = inject(INJECTOR) as EnvironmentInjector
      const storeInjector = createEnvironmentInjector([Events], parent)
      setMeta(injector, storeInjector, instance)
      for (const action of getActions(target)) {
         const childInjector = createEnvironmentInjector([{ provide: ACTION, useValue: action }, Effect], storeInjector)
         setMeta(injector, childInjector, instance, action.key)
      }
      return instance
   })
}

let id = 0

function dispatch(type: ActionType, context: {}, name: string, value: unknown) {
   const events = getToken(Events, context)
   events.push({
      id: id++,
      timestamp: Date.now(),
      type,
      context,
      name,
      value,
   })
}

function runInContext<T extends (...args: any) => any>(deps: DepMap, fn: T, context: {}, ...args: Parameters<T>) {
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
      const events = getToken(Events, this)
      events.push({
         id: id++,
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

function isPlainObject(obj: object) {
   const proto = Object.getPrototypeOf(obj)
   return proto === null || proto === Object.prototype
}

const observers = [ActionType.Next, ActionType.Error, ActionType.Complete]

export function createDispatch<T>(token: ProviderToken<T>): Dispatch {
   return function (source, observer = {}) {
      const action = inject(ACTION)
      const context = observer && !isPlainObject(observer) ? observer : inject(token)
      const events = inject(Events)
      const effect = inject(Effect)
      for (const key of observers) {
         if (key in observer) {
            wrap(observer, key, function (fn, value) {
               dispatch(key, context, action.key, value)
               fn.call(context, value)
               markDirty(context)
               events.flush()
            })
         }
      }
      const signal = new Subject()
      const operator = operators.get(source)

      operators.set(source, operator)
      effect.enqueue(source.pipe(tap(observer), tap(signal)))

      return signal as any
   }
}

const operators = new WeakMap()

export function createEffect<T>(source: Observable<T>, operator: OperatorFunction<ObservableInput<T>, T>): Observable<T> {
   operators.set(source, operator)
   return source
}

@Injectable()
class Events {
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
class Effect {
   source = new Subject<Observable<any>>()
   queue: Observable<any>[] = []
   operator!: OperatorFunction<ObservableInput<any>, any>
   destination!: Subject<any>

   next(source: Observable<any>) {
      this.operator = operators.get(source)
      if (this.destination.closed) {
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
      this.destination = new Subject()
      this.source.pipe(this.operator).subscribe(this.destination)
   }

   subscribe(observer: PartialObserver<any>) {
      return this.destination.subscribe(observer)
   }
}

export function select<T extends {}>(token: ProviderToken<T>): T {
   const instance = inject(token)
   if (meta.has(token) && !getMeta("connect", instance, token as any)) {
      const cdr = inject(ChangeDetectorRef, { optional: true }) as ViewRef
      if (cdr) {
         const subscription = inject(DISPATCHER).subscribe((event) => {
            if (cdr.destroyed) subscription.unsubscribe()
            if (event.context === instance) {
               cdr.markForCheck()
            }
         })
         setMeta("connect", subscription, instance, token as any)
      }
   }
   return track(instance)
}

@Directive()
export class Fragment implements AfterViewInit, OnDestroy {
   __element__ = inject(ElementRef).nativeElement
   __nodes__: ChildNode[] = []

   ngAfterViewInit() {
      const el = this.__element__
      const parent = el.parentNode;
      this.__nodes__ = [...el.childNodes]

      while (el.firstChild) parent.insertBefore(el.firstChild, el);

      parent.removeChild(el);
   }

   ngOnDestroy() {
      for (const node of this.__nodes__) node.remove()
   }
}

@Directive()
export class Provider extends Fragment implements OnChanges {
   @Input("value") set __value__(_: Omit<this, "__value__">) {}

   ngOnChanges(this: any, { __value__ }: SimpleChanges) {
      if (__value__) {
         for (const key of Object.keys(this)) {
            if (!(key in __value__)) {
               delete this[key]
            }
         }
         Object.assign(this, __value__)
      }
   }
}
