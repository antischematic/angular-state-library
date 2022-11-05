import {DOCUMENT} from "@angular/common";
import {inject, Injectable, NgZone} from "@angular/core";
import {
   BehaviorSubject,
   distinctUntilChanged,
   EMPTY,
   filter,
   finalize,
   fromEvent,
   interval,
   map,
   merge,
   MonoTypeOperatorFunction,
   Observable,
   repeat,
   ReplaySubject,
   share,
   skipUntil,
   Subject,
   switchMap,
   takeUntil,
   tap,
   timer,
} from "rxjs";

export interface QueryOptions<T = any> {
   key: unknown[]
   refreshInterval?: number
   refreshOnFocus?: boolean
   refreshOnReconnect?: boolean
   refreshIfStale?: boolean
   staleTime?: number
   cacheTime?: number
}

export interface MutateOptions {
   invalidate?: unknown[] | unknown[][]
}

function onVisible(document: Document) {
   return fromEvent(document, "visibilitychange").pipe(
      filter(() => document.visibilityState === "visible")
   )
}

function onReconnect(document: Document) {
   const window = document.defaultView
   if (window) {
      return fromEvent(window, "online")
   } else {
      return EMPTY
   }
}

function observeInZone(source: Observable<any>, zone: NgZone) {
   return new Observable(subscriber => {
      return zone.runOutsideAngular(() => source.subscribe(subscriber))
   })
}

@Injectable({ providedIn: "root" })
export class ResourceManager {
   cache = new Map()
   document = inject(DOCUMENT)
   ngZone = inject(NgZone)

   keygen(seed: unknown[]) {
      return JSON.stringify(seed)
   }

   query<T>(source: Observable<T>, options: QueryOptions): Observable<T> {
      const key = this.keygen(options.key)
      const { cache, document } = this

      if (cache.has(key)) {
         const { resource, invalidate } = cache.get(key)
         if (options.refreshIfStale !== false) {
            invalidate.next()
         }
         return resource
      }

      const invalidate = new Subject<void>()
      const cancel = new Subject<void>()
      const refCount = new BehaviorSubject(0)
      const stale = invalidate.pipe(
         skipUntil(observeInZone(timer(options.staleTime ?? 0), this.ngZone))
      )
      const invalidators = [stale] as Observable<any>[]

      if (options.refreshOnFocus) {
         invalidators.push(onVisible(document))
      }

      if (options.refreshOnReconnect) {
         invalidators.push(onReconnect(document))
      }

      if (options.refreshInterval) {
         const nativeInterval = observeInZone(interval(options.refreshInterval), this.ngZone)
         invalidators.push(
            refCount.pipe(
               map(count => count > 0),
               distinctUntilChanged(),
               switchMap((active) => {
                  return active ? nativeInterval : EMPTY
               })
            )
         )
      }

      const reload = merge(...invalidators)

      const resource = source.pipe(
         takeUntil(cancel),
         repeat({ delay: () => reload }),
         share({
            connector: () => new ReplaySubject(1, options.cacheTime ?? Infinity),
            resetOnError: false,
            resetOnComplete: false,
            resetOnRefCountZero: false
         }),
         tap({
            subscribe: () => refCount.next(refCount.value + 1),
            unsubscribe: () => refCount.next(refCount.value - 1),
         })
      )

      cache.set(key, {
         resource,
         cancel,
         invalidate,
         options
      })

      return resource
   }

   cancel(key: string) {
      for (const [matchKey, { cancel }] of this.cache) {
         if (matchKey.startsWith(key.slice(0, key.length - 2))) {
            cancel.next()
         }
      }
   }

   invalidate(key: string) {
      for (const [matchKey, { invalidate }] of this.cache) {
         if (matchKey.startsWith(key.slice(0, key.length - 2))) {
            invalidate.next()
         }
      }
   }

   mutate<T>(source: Observable<T>, options: MutateOptions) {
      const keys = options.invalidate ? Array.isArray(options.invalidate[0]) ? (options.invalidate as unknown[][]).map(this.keygen) : [this.keygen(options.invalidate)] : []
      for (const key of keys) {
         this.cancel(key)
      }
      return source.pipe(
         finalize(() => {
            for (const key of keys) {
               this.invalidate(key)
            }
         }),
      )
   }
}

export function useQuery<T>(options: QueryOptions<T>): MonoTypeOperatorFunction<T> {
   const resource = inject(ResourceManager)
   return source => resource.query(source, options)
}

export function useMutation<T>(options: MutateOptions): MonoTypeOperatorFunction<T> {
   const resource = inject(ResourceManager)
   return source => resource.mutate(source, options)
}
