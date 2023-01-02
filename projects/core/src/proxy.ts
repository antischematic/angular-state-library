import {DepMap} from "./interfaces";

const cache = new WeakMap()
const proxies = new WeakMap()

let deps: Map<any, Map<any, any>>[] = []

export function pushStack(value: Map<any, any>) {
   deps.unshift(value)
}

export function popStack() {
   deps.shift()
}

function isTracking() {
   return deps.length > 0
}

export const changesMap = new WeakMap()

export function getChanges(deps: DepMap) {
   const changes = changesMap.get(deps) ?? new Map()
   changesMap.set(deps, changes)
   return changes
}

export function addDep(object: object, key: PropertyKey, value: any, previous: any = value, update = false) {
   if (isTracking()) {
      let seen = false
      for (const dep of deps) {
         const keyValues = dep.get(object) ?? new Map
         dep.set(object, keyValues)
         if (!seen && update && !Object.is(value, previous)) {
            seen = true
            const changes = getChanges(dep)
            const change = changes.get(object) ?? new Map()
            changes.set(object, change)
            if (!change.has(key)) {
               change.set(key, untrack(previous))
            }
         }
         if (update && keyValues.has(key) || !update) {
            keyValues.set(key, value)
         }
      }
   }
}

function createObjectProxy(object: object) {
   return new Proxy(object, {
      get(target: object, p: string | symbol): any {
         const value = Reflect.get(target, p)
         if (typeof value === "function") {
            return new Proxy(value, {
               apply(target: any, thisArg: any, argArray: any[]): any {
                  return Reflect.apply(target, untrack(thisArg), argArray)
               }
            })
         }
         addDep(target, p, value)
         return value
      },
      set(target: object, p: string | symbol, value: any, receiver: any): boolean {
         const previous = Reflect.get(target, p)
         const result = Reflect.set(target, p, value, receiver)
         addDep(target, p, value, previous, true)
         return result
      },
      deleteProperty(target: object, p: string | symbol): boolean {
         const previous = Reflect.get(target, p)
         const result = Reflect.deleteProperty(target, p)
         addDep(target, p, void 0, previous, true)
         return result
      }
   })
}

export function createProxy(object: object) {
   if (!isObject(object)) return object
   if (cache.has(object)) {
      return cache.get(object)!
   }
   const proxy = createObjectProxy(object)
   cache.set(object, proxy)
   proxies.set(proxy, object)
   return proxy
}

export function isTracked(object: any) {
   return proxies.has(object)
}

function isObject(value: any) {
   return typeof value === "object" && value !== null
}

export function track<T>(object: T): T {
   return isObject(object) && !isTracked(object) ? createProxy(object as any) : object
}

export function untrack<T>(object: T): T {
   return proxies.get(object as any) ?? object
}
