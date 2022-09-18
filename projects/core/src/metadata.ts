export const meta = new WeakMap()

function ensureKey(target: WeakMap<any, any>, key: any) {
   return target.has(key) ? target.get(key)! : target.set(key, new Map()).get(key)!
}

export function getMetaKeys<T>(metaKey: any, target: object): Map<unknown, T> {
   return ensureKey(ensureKey(meta, target), metaKey)
}

export function getMeta<T>(metaKey: any, target: object, key?: PropertyKey): T | undefined {
   return getMetaKeys<any>(metaKey, target).get(key)
}

export function setMeta(metaKey: any, value: any, target: object, key?: PropertyKey) {
   return ensureKey(ensureKey(meta, target), metaKey).set(key, value)
}

export function getMetaValues<T>(metaKey: any, target: object): T[] {
   return Array.from(getMetaKeys<any>(metaKey, target).values())
}
