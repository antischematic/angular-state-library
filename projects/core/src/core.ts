import {
   createEnvironmentInjector,
   EnvironmentInjector,
   ErrorHandler,
   inject,
   INJECTOR, ProviderToken
} from "@angular/core";
import {filter, map} from "rxjs";
import {DepMap, EventType, Phase, SelectMetadata} from "./interfaces";
import {
   getActions,
   getAttachments,
   getDeps,
   getMeta,
   getMetaValues,
   getSelectors,
   getToken,
   injector,
   markDirty,
   setMeta,
   tracked
} from "./metadata";
import {
   ACTION,
   Changes,
   CONTEXT,
   EffectScheduler,
   EVENTS,
   EventScheduler,
   ROOT_CONFIG,
   STORE_CONFIG,
   StoreErrorHandler,
   Teardown
} from "./providers";
import {createProxy, popStack, pushStack, untrack} from "./proxy";
import {subscribe} from "./select";
import {call, wrap} from "./utils";

function checkDeps(deps: DepMap) {
   let dirty = false
   for (const [object, keyValues] of deps) {
      for (const [key, previous] of keyValues) {
         const current = object[key]
         if (!Object.is(current, previous)) {
            keyValues.set(key, current)
            dirty = true
         }
      }
   }
   return dirty
}

export function decorateCheck(target: {}, name: Phase) {
   const actions = getActions(target, name)
   wrap(target, name, function (fn) {
      const events = getToken(EventScheduler, this)
      for (const action of actions) {
         const deps = getDeps(this, action.key)
         const dirty = action.track && deps && checkDeps(deps)
         if (action.descriptor?.value.length === 0 && (!deps && action.immediate && action.phase === name || dirty)) {
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

function getConfig() {
   return inject(STORE_CONFIG, { self: true, optional: true }) ?? inject(ROOT_CONFIG)
}

export function setup(target: any, factory: any, ...args: any[]) {
   const instance = factory(...args)
   const prototype = target.prototype
   const parent = inject(INJECTOR) as EnvironmentInjector
   const errorHandler = new StoreErrorHandler(prototype, instance)
   const storeInjector = createEnvironmentInjector([Changes,
      { provide: ErrorHandler, useValue: errorHandler},
      { provide: EventScheduler, useValue: new EventScheduler(instance) },
      Teardown
   ], parent)
   let storeConfig = getConfig()
   setMeta(injector, storeInjector, instance)
   for (const action of getActions(prototype)) {
      const actionInjector = createEnvironmentInjector([
         { provide: ACTION, useValue: action },
         { provide: CONTEXT, useValue: {instance}},
         EffectScheduler,
         Teardown,
         storeConfig?.actionProviders ?? []
      ], storeInjector)
      setMeta(injector, actionInjector, instance, action.key)
   }
   return instance
}

export const stores = new Set<any>()
const decorated = new WeakSet()

export function decorateFactory(target: any, fn: (this: any, ...args: any[]) => any, ...additionalArgs: any[]) {
   const factory = target["ɵfac"]
   if (factory) {
      Object.defineProperty(target, "ɵfac", {
         configurable: true,
         value: function (...args: any[]) {
            return fn(target, factory, ...additionalArgs, ...args)
         }
      })
   }
}

export function runInContext<T extends (...args: any) => any>(deps: DepMap, fn: T, context = {}, catchError = true, key?: string, ...args: Parameters<T>) {
   const injector = getToken(EnvironmentInjector, untrack(context), key)
   const errorHandler = injector.get(ErrorHandler)
   pushStack(deps)
   try {
      return injector.runInContext(() => fn.apply(context, args))
   } catch (e) {
      if (catchError) {
         errorHandler.handleError(e)
      } else {
         throw e
      }
   } finally {
      popStack()
   }
}

function runAction(this: any, fn: any, key: any, ...args: any[]) {
   const event = inject(EventScheduler)
   event.schedule(EventType.Dispatch, key, args)
   return fn.apply(this, args)
}

export function decorateActions(target: {}) {
   for (const { key, catchError } of getActions(target)) {
      wrap(target, key, function (fn, ...args) {
         const proxy = createProxy(this)
         const deps = new Map()
         setMeta(tracked, deps, this, key)
         teardown(this, key)
         return runInContext(deps, runAction, proxy, catchError, key, fn, key, ...args)
      })
   }
}

export function decorateAttachment(target: any) {
   target.ngOnSelect ??= function (this: any, observer: any) {
      return inject(EVENTS).pipe(
         filter(event => event.context === this),
         map(() => this),
      ).subscribe(observer)
   }
}

export function decorateSelectors(target: {}) {
   for (const { key } of getSelectors<SelectMetadata>(target, true)) {
      wrap(target, key, function (fn, ...args) {
         const cacheKey = key + JSON.stringify(args)
         const proxy = createProxy(this)
         const deps = getDeps(this, cacheKey)
         const dirty = deps ? checkDeps(deps) : true
         let result = getMeta(cacheKey, this, key)
         if (dirty) {
            const newDeps = new Map()
            result = runInContext(newDeps, fn, proxy, true, void 0, ...args)
            setMeta(cacheKey, result, this, key)
            setMeta(tracked, newDeps, this, cacheKey)
         }
         return result
      })
   }
}

export function decorateChanges(target: {}) {
   wrap(target, "ngOnChanges", function (fn, value) {
      const events = getToken(EventScheduler, this)
      const changes = getToken(Changes, this)
      events.schedule(EventType.Dispatch, "ngOnChanges", value)
      changes.setValue(value)
      fn.call(this, value)
   })
}

export function decorateOnInit(target: {}) {
   wrap(target, "ngOnInit", function (fn) {
      const injector = getToken(EnvironmentInjector, this)
      for (const attachment of getSelectors<{ token: ProviderToken<any> | undefined }>(target, false)) {
         injector.runInContext(() => {
            subscribe(attachment.token, this, attachment.key)
         })
      }
      fn.call(this)
   })
}

export function decorateDestroy(target: {}) {
   wrap(target, "ngOnDestroy", function (fn) {
      for (const environmentInjector of getMetaValues<EnvironmentInjector>(injector, this)) {
         environmentInjector.destroy()
      }
      fn.apply(this)
   })
}

function teardown(context: {}, key: string) {
   getToken(Teardown, context, key)?.unsubscribe()
}
