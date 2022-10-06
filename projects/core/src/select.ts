import {inject, KeyValueDiffers, ProviderToken} from "@angular/core";
import {distinctUntilChanged, filter, map, Observable} from "rxjs";
import {FLUSHED} from "./providers";

export type Selector<T> = {
   [key in keyof T]: Observable<T[key]>
}

export function select<T extends {}>(token: ProviderToken<T>): Selector<T> {
   const store = inject(token)
   const flushed = inject(FLUSHED)

   return new Proxy(store, {
      get(target: T, property: PropertyKey) {
         return flushed.pipe(
            filter((context): context is T => context === store),
            map(context => context[property as keyof T]),
            distinctUntilChanged(Object.is)
         )
      }
   }) as unknown as Selector<T>
}

export function selectStore<T extends {}>(token: ProviderToken<T>): Observable<T> {
   const store = inject(token)
   const differ = inject(KeyValueDiffers).find(store).create()
   return inject(FLUSHED).pipe(
      filter((context): context is T => context === store),
      distinctUntilChanged(() => differ.diff(store) === null)
   )
}
