import {inject, KeyValueDiffers, ProviderToken} from "@angular/core";
import {defer, distinctUntilChanged, filter, map, Observable, share, startWith} from "rxjs";
import {FLUSHED} from "./providers";
import {getMeta, selector, setMeta} from "./metadata";

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
               share()
            ))
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
         share()
      )
      setMeta(selector, source, store)
      return source
   }
}
