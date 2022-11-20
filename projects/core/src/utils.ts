import {inject, InjectionToken, Injector, INJECTOR, ProviderToken} from "@angular/core";
import {defer, filter, map, Observable, OperatorFunction, tap} from "rxjs";
import {
   CompleteEvent,
   DispatchEvent, ErrorEvent,
   EventType,
   ExtractEvents, NextEvent,
   StoreConfig,
   StoreEvent,
   ZoneCompatible
} from "./interfaces";
import {EVENTS, ROOT_CONFIG, STORE_CONFIG} from "./providers";
import {track, untrack} from "./proxy";

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

export const UID = new InjectionToken("UID", {
   factory() {
      let id = 0
      return function getId() {
         return id++
      }
   }
})

export function events<T>(token: ProviderToken<T>, injector?: Injector): Observable<ExtractEvents<T, Extract<keyof T, string>>>
export function events<T>(context: T): Observable<ExtractEvents<T, Extract<keyof T, string>>>
export function events<T>(token: ProviderToken<T> | T, injector = inject(INJECTOR)): Observable<ExtractEvents<T, Extract<keyof T, string>>> {
   return defer(() => {
      const context = typeof token === "function" ? injector.get(token) : token
      return injector.get(EVENTS).pipe(
         filter(event => event.context === context)
      )
   }) as Observable<ExtractEvents<T, Extract<keyof T, string>>>
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

export function set<T extends { value: unknown, next: (value: T["value"]) => void }>(token: ProviderToken<T>, value: T["value"]): void {
   inject(token).next(value)
}

type ActionParams<T> = T extends (...params: infer Params) => any ? Params extends { length: 1 } ? Params[0] : Params : never

function filterByNameType<T extends StoreEvent>(name: PropertyKey, type: EventType): OperatorFunction<any, T> {
   return filter((event: StoreEvent): event is T => event.name === name && event.type === type)
}

export function actionEvent<T, TKey extends keyof T>(token: ProviderToken<T>, name: TKey, injector?: Injector): Observable<DispatchEvent> {
   return events(token, injector).pipe(
      filterByNameType<DispatchEvent<any, any, any[]>>(name, EventType.Dispatch),
   )
}

export function action<T, TKey extends keyof T>(token: ProviderToken<T>, name: TKey, injector?: Injector): Observable<ActionParams<T[TKey]>> {
   return actionEvent(token, name, injector).pipe(
      map((event: any) => event.value)
   )
}

export function nextEvent<T, TKey extends keyof T>(token: ProviderToken<T>, name: TKey, injector?: Injector): Observable<NextEvent> {
   return events(token, injector).pipe(
      filterByNameType<NextEvent>(name, EventType.Next)
   )
}

export function next<T, TKey extends keyof T>(token: ProviderToken<T>, name: TKey, injector?: Injector): Observable<T[TKey] extends () => infer R ? R extends Observable<infer S> ? S : never : never> {
   return nextEvent(token, name, injector).pipe(
      map((event) => event.value)
   )
}

export function errorEvent<T, TKey extends keyof T>(token: ProviderToken<T>, name: TKey, injector?: Injector): Observable<ErrorEvent> {
   return events(token, injector).pipe(
      filterByNameType<ErrorEvent>(name, EventType.Error)
   )
}

export function error<T, TKey extends keyof T>(token: ProviderToken<T>, name: TKey, injector?: Injector): Observable<unknown> {
   return errorEvent(token, name, injector).pipe(
      map((event) => event.value)
   )
}

export function completeEvent<T, TKey extends keyof T>(token: ProviderToken<T>, name: TKey, injector?: Injector): Observable<CompleteEvent> {
   return events(token, injector).pipe(
      filterByNameType<CompleteEvent>(name, EventType.Complete)
   )
}

export function complete<T, TKey extends keyof T>(token: ProviderToken<T>, name: TKey, injector?: Injector): Observable<void> {
   return completeEvent(token, name, injector).pipe(
      filterByNameType<CompleteEvent>(name, EventType.Complete),
      map(() => undefined)
   )
}
