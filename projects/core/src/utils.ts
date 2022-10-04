import {untrack} from "./proxy";
import {inject, Type} from "@angular/core";
import {filter, Observable} from "rxjs";
import {ExtractEvents, StoreConfig} from "./interfaces";
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

export function fromStore<T>(type: Type<T>): Observable<ExtractEvents<T, keyof T>>
export function fromStore<T>(type: T): Observable<ExtractEvents<T, keyof T>>
export function fromStore(type: Type<any>): Observable<ExtractEvents<any, any>> {
   const instance = typeof type === "function" ? inject(type) : type
   return inject(EVENTS).pipe(
      filter(event => event.context === instance)
   ) as any
}

export function configureStore(config: StoreConfig) {
   return {
      provide: config.root ? ROOT_CONFIG : STORE_CONFIG,
      useValue: config
   }
}

export class EffectError {
   constructor(public error: unknown) {
   }
}

