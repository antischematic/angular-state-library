const cache = new WeakMap()
const proxies = new WeakSet()

let deps: Map<any, any>

function setDeps(value: Map<any, any>) {
  const previous = deps
  deps = value
  return previous
}

export function getContext() {
  return deps
}

function createObjectProxy(object: object, keys: Map<PropertyKey, unknown>) {
  return new Proxy(object, {
    get(target: object, p: string | symbol, receiver: any): any {
      const value = Reflect.get(target, p, receiver)
      if (Reflect.getOwnPropertyDescriptor(target, p)) {
        keys.set(p, value)
      }
      return value
    },
    set(target: object, p: string | symbol, value: any, receiver: any): boolean {
      const result = Reflect.set(target, p, value, receiver)
      if (keys.has(p)) {
        keys.set(p, value)
      }
      return result
    },
    deleteProperty(target: object, p: string | symbol): boolean {
      const result = Reflect.deleteProperty(target, p)
      if (keys.has(p)) {
        keys.set(p, void 0)
      }
      return result
    }
  })
}

export function createProxy(object: object, depMap: Map<any, any> = deps) {
  if (cache.has(object)) {
    return cache.get(object)!
  }
  let proxy
  const keys = new Map()
  switch (Object.prototype.toString.call(object)) {
    case "[object Set]":
      proxy = new SetProxy(object as Set<unknown>, keys)
      break
    case "[object Map]":
      proxy = new MapProxy(object as Map<unknown, unknown>, keys)
      break
    default:
      proxy = createObjectProxy(object, keys)
  }
  depMap.set(object, keys)
  cache.set(object, proxy)
  proxies.add(proxy)
  return proxy
}

class SetProxy implements Set<unknown> {
  get [Symbol.toStringTag]() {
    this.deps.set(toStringTag, this.set[Symbol.toStringTag])
    return this.set[Symbol.toStringTag]
  }

  get size() {
    const value = this.set.size
    this.deps.set(size, value)
    return value
  }

  *[Symbol.iterator](): IterableIterator<unknown> {
    const iterator = this.set[Symbol.iterator]()
    for (const item of iterator) {
      this.deps.set(item, item)
      yield item
    }
  }

  add(value: unknown): this {
    this.set.add(value)
    return this
  }

  clear(): void {
    this.set.clear()
  }

  delete(value: unknown): boolean {
    return this.set.delete(value);
  }

  *entries(): IterableIterator<[unknown, unknown]> {
    const iterator = this.set.entries();
    for (const item of iterator) {
      this.deps.set(item[0], item[0])
      yield item
    }
  }

  forEach(callbackfn: (value: unknown, value2: unknown, set: Set<unknown>) => void, thisArg?: any): void {
    for (const key of this.set.keys()) {
      this.deps.set(key, key)
    }
    this.set.forEach(callbackfn, thisArg)
  }

  has(value: unknown): boolean {
    this.deps.set(value, value)
    return this.set.has(value);
  }

  *keys(): IterableIterator<unknown> {
    const iterator = this.set.keys();
    for (const item of iterator) {
      this.deps.set(item, item)
      yield item
    }
  }

  *values(): IterableIterator<unknown> {
    const iterator = this.set.values();
    for (const item of iterator) {
      this.deps.set(item, item)
      yield item
    }
  }

  constructor(private set: Set<unknown>, private deps: Map<any, any>) {}
}

export const size = Symbol("size")
export const toStringTag = Symbol("Symbol.toStringTag")

class MapProxy implements Map<unknown, unknown> {
  get [Symbol.toStringTag]() {
    const value = this.map[Symbol.toStringTag]
    this.deps.set(toStringTag, value)
    return value
  }

  get size() {
    const value = this.map.size
    this.deps.set(size, value)
    return value
  }

  *[Symbol.iterator](): IterableIterator<[unknown, unknown]> {
    const iterator = this.map[Symbol.iterator]()
    for (const item of iterator) {
      this.deps.set(item[0], item[1])
      yield item
    }
  }

  get(key: unknown) {
    const value = this.map.get(key)
    this.deps.set(key, value)
    return value
  }

  set(key: unknown, value: unknown): this {
    this.map.set(key, value)
    return this
  }

  clear(): void {
    this.map.clear()
  }

  delete(value: unknown): boolean {
    return this.map.delete(value);
  }

  *entries(): IterableIterator<[unknown, unknown]> {
    const iterator = this.map.entries();
    for (const item of iterator) {
      this.deps.set(item[0], item[1])
      yield item
    }
  }

  forEach(callbackfn: (value: unknown, value2: unknown, map: Map<unknown, unknown>) => void, thisArg?: any): void {
    for (const [key, value] of this.map.entries()) {
      this.deps.set(key, value)
    }
    this.map.forEach(callbackfn, thisArg)
  }

  has(key: unknown): boolean {
    this.deps.set(key, this.map.get(key))
    return this.map.has(key);
  }

  *keys(): IterableIterator<unknown> {
    const iterator = this.map.entries();
    for (const [key, value] of iterator) {
      this.deps.set(key, value)
      yield key
    }
  }

  *values(): IterableIterator<unknown> {
    const iterator = this.map.entries();
    for (const [key, value] of iterator) {
      this.deps.set(key, value)
      yield value
    }
  }

  constructor(private map: Map<unknown, unknown>, private deps: Map<any, any>) {}
}

export function isProxy(object: object) {
  return proxies.has(object)
}

export function runInContext<T extends (...args: any[]) => any>(deps: Map<any, any>, fn: T, thisArg: any = null, ...args: any[]) {
  const previous = setDeps(deps)
  try {
    return fn.apply(thisArg, args)
  } finally {
    setDeps(previous)
  }
}

export function track<T extends object>(object: T): T {
  return createProxy(object)
}
