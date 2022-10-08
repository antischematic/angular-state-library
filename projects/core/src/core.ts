import {
   createEnvironmentInjector,
   EnvironmentInjector,
   ErrorHandler,
   inject,
   INJECTOR
} from "@angular/core";
import {createProxy, popStack, pushStack, untrack} from "./proxy";
import {
   getActions,
   getDeps,
   getMeta,
   getMetaValues,
   getSelectors,
   getStatuses,
   getToken,
   injector,
   markDirty, selector,
   setMeta,
   tracked
} from "./metadata";
import {
   ActionMetadata,
   DepMap,
   EventType,
   Metadata,
   Phase,
   StatusMetadata,
   StoreConfig
} from "./interfaces";
import {call, wrap} from "./utils";
import {noopTransition, Transition} from "./transition";
import {
   ACTION,
   Changes,
   CONTEXT,
   EffectScheduler,
   EventScheduler,
   ROOT_CONFIG,
   STORE_CONFIG,
   StoreErrorHandler,
   Teardown
} from "./providers";

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
         if (action.descriptor!.value.length === 0 && (!deps && action.immediate && action.phase === name || dirty)) {
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

function createInjector(meta: Metadata<ActionMetadata>, instance: {}, transition: Transition, config: StoreConfig, parent: EnvironmentInjector) {
   const actionInjector = createEnvironmentInjector([
      { provide: ACTION, useValue: meta },
      { provide: CONTEXT, useValue: {instance}},
      { provide: Transition, useValue: transition },
      EffectScheduler,
      Teardown,
      config?.actionProviders ?? []
   ], parent)
   setMeta(injector, actionInjector, instance, meta.key)
}

function setup(instance: any, target: Function, statusMap: any) {
   if (getMeta(injector, instance)) return
   const prototype = target.prototype
   const parent = inject(INJECTOR) as EnvironmentInjector
   const errorHandler = new StoreErrorHandler(prototype, instance, parent.get(ErrorHandler))
   const storeInjector = createEnvironmentInjector([Changes,
      { provide: ErrorHandler, useValue: errorHandler},
      { provide: EventScheduler, useValue: new EventScheduler(instance) }
   ], parent)
   const storeStatus = statusMap.get(void 0)
   const transition = storeStatus ? instance[storeStatus.key] : noopTransition
   let config = getConfig()
   setMeta(injector, storeInjector, instance)
   for (const action of getActions(prototype)) {
      createInjector(action, instance, transition, config, storeInjector)
   }
   for (const selector of getSelectors(prototype)) {
      createInjector(selector, instance, transition, config, storeInjector)
   }
}

export const stores = new Set<any>()
const decorated = new WeakSet()

export function decorateFactory(target: any) {
   const factory = target["ɵfac"]
   const statusMap = getStatuses(target.prototype).reduce((map, next) => map.set(next.action, next), new Map<string | undefined, Metadata<StatusMetadata>>())
   stores.add(target)
   if (factory && !decorated.has(target)) {
      decorated.add(target)
      Object.defineProperty(target, "ɵfac", {
         configurable: true,
         value: function (...args: any[]) {
            const instance = factory(...args)
            setup(instance, target, statusMap)
            return instance
         }
      })
   }
}

function runInContext<T extends (...args: any) => any>(deps: DepMap, fn: T, context = {}, key?: string, ...args: Parameters<T>) {
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
   event.schedule(EventType.Dispatch, key, args)
   return fn.apply(this, args)
}

export function decorateActions(target: {}) {
   for (const { key } of getActions(target)) {
      wrap(target, key, function (fn, ...args) {
         const proxy = createProxy(this)
         const deps = new Map()
         setMeta(tracked, deps, this, key)
         teardown(this, key)
         return runInContext(deps, runAction, proxy, key, fn, key, ...args)
      })
   }
}

export function decorateSelectors(target: {}) {
   for (const { key } of getSelectors(target)) {
      wrap(target, key, function (fn, ...args) {
         const cacheKey = key + JSON.stringify(args)
         const proxy = createProxy(this)
         const deps = getDeps(this, cacheKey)
         const dirty = deps ? checkDeps(deps) : true
         const previous = getMeta(selector, this, key)
         let result = getMeta(cacheKey, this, key)
         if (dirty) {
            try {
               const newDeps = new Map()
               setMeta(selector, cacheKey, this)
               result = runInContext(newDeps, fn, proxy, key, ...args)
               setMeta(cacheKey, result, this, key)
               setMeta(tracked, newDeps, this, cacheKey)
            } finally {
               setMeta(selector, previous, this, key)
            }
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
