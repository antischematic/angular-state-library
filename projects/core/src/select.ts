import {inject, KeyValueDiffers, ProviderToken} from "@angular/core";
import {
   defer,
   distinctUntilChanged,
   filter,
   map,
   Observable,
   shareReplay,
   startWith,
   tap
} from "rxjs";
import {ACTION, CONTEXT, EffectScheduler, FLUSHED} from "./providers";
import {getMeta, selector, setMeta} from "./metadata";
import {EventType, Metadata, NextEvent, SelectMetadata, StoreEvent} from "./interfaces";
import {dispatch} from "./dispatch";
import {untrack} from "./proxy";
import {events} from "./utils";

export type Selector<T> = {
   [key in keyof T]: Observable<T[key]>
}

export function select<T extends {}>(token: ProviderToken<T>): Selector<T> {
   const store = inject(token)
   const flushed = inject(FLUSHED)

   return new Proxy(store, {
      get(target: T, property: PropertyKey) {
         const cache = getMeta(selector, store, property)
         if (cache) {
            return cache
         } else {
            const source = defer(() => flushed.pipe(
               filter((context): context is T => context === store),
               map(() => store[property as keyof T]),
               startWith(store[property as keyof T]),
               distinctUntilChanged(Object.is),
            )).pipe(shareReplay(1))
            setMeta(selector, source, store, property)
            return source
         }
      }
   }) as unknown as Selector<T>
}

export function selectStore<T extends {}>(token: ProviderToken<T>): Observable<T> {
   const store = inject(token)
   const cache = getMeta(selector, store) as Observable<T>
   if (cache) {
      return cache
   } else {
      const differ = inject(KeyValueDiffers).find(store).create()
      differ.diff(store)
      const source = inject(FLUSHED).pipe(
         filter((context): context is T => context === store),
         startWith(store),
         distinctUntilChanged((value) => differ.diff(value) === null),
         shareReplay(1)
      )
      setMeta(selector, source, store)
      return source
   }
}

export function snapshot<T>(source: (...args: any[]) => Observable<T>): T | undefined
export function snapshot<T>(source: Observable<T>): T | undefined
export function snapshot<T>(source: Observable<T> | ((...args: any[]) => Observable<T>)): T | undefined {
   const select = inject(ACTION) as Metadata<SelectMetadata>
   const { instance } = inject(CONTEXT) as any
   const scheduler = inject(EffectScheduler)
   const cacheKey = getMeta(selector, instance) as SelectMetadata
   const name = "name" in source ? source.name : ""
   let current = getMeta(cacheKey, instance, select.key) as T

   source = typeof source !== "function"
      ? source
      : events(instance).pipe(
         filter((event: StoreEvent): event is NextEvent => event.name === name && event.type === EventType.Next),
         map((event) => event.value)
      )

   dispatch(source, (value) => {
      current = value
      setMeta(cacheKey, value, instance, select.key)
   })
   const frame = requestAnimationFrame(() => {
      cancelAnimationFrame(frame)
      scheduler.dequeue()
   })
   return current
}
