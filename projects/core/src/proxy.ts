const cache = new WeakMap()
const proxies = new WeakMap()

let deps: Map<any, Map<any, any>>[] = []

export function pushStack(value: Map<any, any>) {
   deps.push(value)
}

export function popStack() {
   deps.pop()
}

function isTracked() {
   return deps.length > 0
}

export const changes = new WeakMap()

function addDep(object: object, key: PropertyKey, value: any, previous: any = value, update = false) {
   if (isTracked()) {
      for (const dep of deps) {
         const keyValues = dep.get(object) ?? new Map
         dep.set(object, keyValues)
         if (update) {
            const changelist = changes.get(keyValues) ?? new Map()
            changes.set(keyValues, changelist)
            if (changelist.has(key)) {
               [previous] = changelist.get(key)
            }
            changelist.set(key, [previous, value])
         }
         if (update && keyValues.has(key) || !update) {
            keyValues.set(key, value)
         }
      }
   }
}

function createObjectProxy(object: object) {
   return new Proxy(object, {
      get(target: object, p: string | symbol, receiver: any): any {
         const value = Reflect.get(target, p, receiver)
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

export function isProxy(object: object) {
   return proxies.has(object)
}

function isObject(value: any) {
   return typeof value === "object" && value !== null
}

export function track<T>(object: T): T {
   return isObject(object) ? createProxy(object as any) : object
}

export function untrack<T>(object: T): T {
   return proxies.get(object as any) ?? object
}
