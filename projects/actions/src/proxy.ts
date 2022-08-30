const cache = new WeakMap()
const proxies = new WeakSet()

let deps: Map<any, any>[] = []

function pushStack(value: Map<any, any>) {
  deps.push(value)
}

function popStack() {
  deps.pop()
}

function isTracked() {
  return deps.length > 0
}

function addDep(object: object, key: PropertyKey, value: any, update = false) {
  if (isTracked() && Reflect.getOwnPropertyDescriptor(object, key)) {
    for (const dep of deps) {
      const keyValues = dep.get(object) ?? new Map
      dep.set(object, keyValues)
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
      const result = Reflect.set(target, p, value, receiver)
      addDep(target, p, value, true)
      return result
    },
    deleteProperty(target: object, p: string | symbol): boolean {
      const result = Reflect.deleteProperty(target, p)
      addDep(target, p, void 0, true)
      return result
    }
  })
}

export function createProxy(object: object) {
  if (cache.has(object)) {
    return cache.get(object)!
  }
  const proxy = createObjectProxy(object)
  cache.set(object, proxy)
  proxies.add(proxy)
  return proxy
}

export function isProxy(object: object) {
  return proxies.has(object)
}

export function runInContext<T extends (...args: any[]) => any>(deps: Map<any, any>, fn: T, thisArg: any = null, ...args: any[]) {
  pushStack(deps)
  try {
    return fn.apply(thisArg, args)
  } finally {
    popStack()
  }
}

export function track<T extends object>(object: T): T {
  return createProxy(object)
}
