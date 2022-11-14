import {inject, Injectable, KeyValueDiffers, ProviderToken, Type} from "@angular/core";
import {
   BehaviorSubject,
   defer,
   distinctUntilChanged, EMPTY,
   filter, isObservable,
   map, mergeWith,
   Observable,
   shareReplay,
   startWith,
} from "rxjs";
import {Select} from "./decorators";
import {NextEvent, StoreEvent} from "./interfaces";
import {getMeta, selector, setMeta} from "./metadata";
import {FLUSHED} from "./providers";
import {events} from "./utils";

export function select<T extends {}>(token: ProviderToken<T>): Select<T> {
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
   }) as unknown as Select<T>
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

export interface WithStateOptions<T> {
   from?: any[] | Observable<T>
}

export interface WithState<T> {
   source: BehaviorSubject<T>
   destination: Observable<T>
   initial: T
}

export interface Selector {
   new<T>(name: string, factory: (withState: (value: T, options?: WithStateOptions<T>) => WithState<T>) => WithState<T>): Type<BehaviorSubject<T>>
   new<T>(name: string, factory: () => Observable<T>): Type<Observable<T>>
}

function withState(initial: any, options: WithStateOptions<any> = {}): WithState<any> {
   const source = new BehaviorSubject(initial)
   const from = options.from
   const destination = source.pipe(
      mergeWith(isObservable(from) ? from : from ? events(from[0]).pipe(
         filter((event: StoreEvent): event is NextEvent => {
            const [name, type] = from[1].split(":")
            return event.name === name && event.type === type
         }),
         map(event => event.value)
      ) : EMPTY)
   )

   return {
      source,
      destination,
      initial
   }
}

export const Selector: Selector = function Selector(name: string, factory: Function) {
   @Injectable({ providedIn: "root" })
   class Selector {
      state = factory(withState)

      get value() {
         return this.state.initial
      }

      next(value: any) {
         this.state.source.next(value)
      }

      subscribe(observer: any) {
         return isObservable(this.state) ? this.state.subscribe(observer) : this.state.destination.subscribe(observer)
      }

      static overriddenName = name
   }
   return Selector
} as any
