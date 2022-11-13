import {track, untrack} from "./proxy";
import {inject, ProviderToken} from "@angular/core";
import {filter, Observable} from "rxjs";
import {ExtractEvents, StoreConfig, ZoneCompatible} from "./interfaces";
import {EVENTS, ROOT_CONFIG, STORE_CONFIG} from "./providers";

export function isPlainObject(obj: object) {
   const proto = Object.getPrototypeOf(obj)
   return proto === null || proto === Object.prototype
}

export function call(target: Record<any, any>, key: string, ...args: any[]) {
   return target[key].apply(target, args)
}

export function wrap(target: { [key: PropertyKey]: any }, property: PropertyKey, fn: (this: any, ...args: any[]) => any) {
   const descriptor = Object.getOwnPropertyDescriptor(target, property)!
   const object = descriptor ? descriptor : target
   const getOrValue = descriptor?.get ? "get" : "value"
   const originalFunction = (descriptor ? descriptor[getOrValue] : object[property]) ?? noop

   Object.defineProperty(target, property, {
      configurable: true,
      [getOrValue]: function (this: unknown, ...args: any[]) {
         return fn.call(untrack(this), originalFunction, ...args)
      }
   })

   return originalFunction === noop
}

export function noop() {}

let id = 0

export function getId() {
   return id++
}

export function events<T>(type: ProviderToken<T>): Observable<ExtractEvents<T, keyof T>>
export function events<T>(type: T): Observable<ExtractEvents<T, keyof T>>
export function events(type: ProviderToken<unknown> | unknown): Observable<ExtractEvents<unknown, any>> {
   const instance = typeof type === "function" ? inject(type) : type
   return inject(EVENTS).pipe(
      filter(event => event.context === instance)
   ) as Observable<ExtractEvents<unknown, any>>
}

export function configureStore(config: StoreConfig) {
   return {
      provide: config.root ? ROOT_CONFIG : STORE_CONFIG,
      useValue: config
   }
}

export function observeInZone<T>(source: Observable<T>, zone: ZoneCompatible): Observable<T> {
   return new Observable(subscriber => {
      return zone.run(() => {
         return source.subscribe(subscriber)
      })
   })
}

export function get<T extends { value: unknown }>(token: ProviderToken<T>): T["value"] {
   return track(inject(token).value)
}
