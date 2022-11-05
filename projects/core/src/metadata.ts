import {ChangeDetectorRef, Injector, ProviderToken} from "@angular/core";
import {
   ActionMetadata,
   CaughtMetadata,
   DepMap, Metadata,
   Phase,
   SelectMetadata,
} from "./interfaces";

export const meta = new WeakMap()

export const action = Symbol("action")
export const selector = Symbol("selector")
export const tracked = Symbol("track")
export const injector = Symbol("injector")
export const caught = Symbol("caught")

function ensureKey(target: WeakMap<any, any>, key: any) {
   return target.has(key) ? target.get(key)! : target.set(key, new Map()).get(key)!
}

export function getMetaKeys<T>(metaKey: any, target: object): Map<unknown, Metadata<T>> {
   return ensureKey(ensureKey(meta, target), metaKey)
}

export function getMeta<T>(metaKey: any, target: object, key?: PropertyKey): Metadata<T> | undefined {
   return getMetaKeys<any>(metaKey, target).get(key)
}

export function setMeta(metaKey: any, value: any, target: object, key?: PropertyKey) {
   return ensureKey(ensureKey(meta, target), metaKey).set(key, value)
}

export function getMetaValues<T>(metaKey: any, target: object): Metadata<T>[] {
   return Array.from(getMetaKeys<any>(metaKey, target).values())
}

export function getActions(target: {}, phase?: Phase) {
   return getMetaValues<ActionMetadata>(action, target).filter(meta => phase ? meta.phase === phase : true)
}

export function getSelectors(target: {}) {
   return getMetaValues<SelectMetadata>(selector, target)
}

export function getErrorHandlers(target: {}) {
   return getMetaValues<CaughtMetadata>(caught, target)
}

export function getDeps(target: {}, key: PropertyKey): DepMap | undefined {
   return getMeta(tracked, target, key)
}

export function getToken<T>(token: ProviderToken<T>, context: {}, key?: string): T {
   return getMeta<Injector>(injector, context, key)?.get(token)!
}

export function markDirty(context: {}) {
   getToken(ChangeDetectorRef, context).markForCheck()
}

