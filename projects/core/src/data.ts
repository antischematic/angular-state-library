import {DOCUMENT} from "@angular/common";
import {inject, Injectable, NgZone} from "@angular/core";
import {
   BehaviorSubject,
   debounce,
   EMPTY,
   filter,
   finalize,
   fromEvent,
   interval,
   merge,
   MonoTypeOperatorFunction,
   Observable,
   of,
   ReplaySubject,
   retry,
   share,
   startWith,
   Subject,
   switchAll,
   switchMap,
   takeUntil,
   tap,
   throttle,
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
   resource?: ResourceManager
}

export interface MutateOptions {
   invalidate?: unknown[] | unknown[][]
   resource?: ResourceManager
}

function onVisible(document: Document, refCount: BehaviorSubject<any>) {
   return toggle(refCount, fromEvent(document, "visibilitychange").pipe(
      filter(() => document.visibilityState === "visible")
   ))
}

function onReconnect(document: Document, refCount: BehaviorSubject<any>) {
   const window = document.defaultView
   if (window) {
      return toggle(refCount, fromEvent(window, "online"))
   } else {
      return EMPTY
   }
}

function observeInRootZone(source: Observable<any>, zone: NgZone) {
   return new Observable(subscriber => {
      return zone.runOutsideAngular(() => source.subscribe(subscriber))
   })
}

function toggle(refCount: BehaviorSubject<number>, source: Observable<any>) {
   const delay = refCount.pipe(
      filter((count) => count > 0)
   )
   const resume = of(null)
   return source.pipe(
      debounce(() => refCount.value > 0 ? resume : delay)
   )
}

@Injectable({ providedIn: "root" })
export class ResourceManager {
   cache = new Map()
   document = inject(DOCUMENT)
   ngZone = inject(NgZone)

   query<T>(source: Observable<T>, options: QueryOptions): Observable<T> {
      const key = this.keygen(options.key)
      const { cache, document } = this

      if (cache.has(key)) {
         const { resource, fetch, errors } = cache.get(key)
         if (options.refreshIfStale !== false) {
            fetch.next(source)
         }
         return merge(resource, errors) as Observable<T>
      }

      const cancel = new Subject<void>()
      const invalidate = new Subject<Observable<T>>()
      const fetch = new BehaviorSubject<Observable<T>>(source)
      const refCount = new BehaviorSubject(0)
      const invalidators = [fetch] as Observable<any>[]

      if (options.refreshOnFocus) {
         invalidators.push(onVisible(document, refCount))
      }

      if (options.refreshOnReconnect) {
         invalidators.push(onReconnect(document, refCount))
      }

      if (options.refreshInterval) {
         const nativeInterval = observeInRootZone(interval(options.refreshInterval), this.ngZone)
         invalidators.push(toggle(refCount, nativeInterval))
      }
      const errors = new Subject<never>()

      const reload = merge(...invalidators).pipe(
         switchMap(() => fetch.pipe(
            takeUntil(cancel)
         )),
         takeUntil(cancel),
         throttle(() => observeInRootZone(timer(options.staleTime ?? 0), this.ngZone)),
      )

      const resource: Observable<T> = invalidate.pipe(
         startWith(null),
         switchMap(() => reload),
         switchAll(),
         retry({
            resetOnSuccess: true,
            delay: (error, retryCount) => {
               fetch.next(void 0 as any)
               errors.error(new QueryError(error, retryCount))
               return resource
            }
         }),
         share({
            connector: () => new ReplaySubject(1, options.cacheTime ?? Infinity),
            resetOnError: false,
            resetOnComplete: false,
            resetOnRefCountZero: false
         }),
         tap({
            subscribe: () => refCount.next(refCount.value + 1),
            unsubscribe: () => refCount.next(refCount.value - 1)
         })
      )

      cache.set(key, {
         resource,
         errors,
         fetch,
         cancel,
         invalidate,
         source,
         options
      })

      return merge(resource, errors)
   }

   mutate<T>(source: Observable<T>, options: MutateOptions) {
      const keys = options.invalidate ? Array.isArray(options.invalidate[0]) ? (options.invalidate as unknown[][]).map(this.keygen) : [this.keygen(options.invalidate)] : []
      for (const key of keys) {
         this.invalidate(key, true)
      }
      return source.pipe(
         finalize(() => {
            for (const key of keys) {
               this.invalidate(key, false)
            }
         }),
      )
   }

   private keygen(seed: unknown[]) {
      return JSON.stringify(seed)
   }

   private invalidate(key: string, doCancel: boolean) {
      for (const [matchKey, { invalidate, cancel }] of this.cache) {
         if (matchKey.startsWith(key.slice(0, key.length - 2))) {
            if (doCancel) {
               cancel.next()
            } else {
               invalidate.next()
            }
         }
      }
   }
}

export function useQuery<T>(options: QueryOptions<T>): MonoTypeOperatorFunction<T> {
   const resource = options.resource ?? inject(ResourceManager)
   return source => resource.query(source, options)
}

export function useMutation<T>(options: MutateOptions): MonoTypeOperatorFunction<T> {
   const resource = options.resource ?? inject(ResourceManager)
   return source => resource.mutate(source, options)
}

export class QueryError {
   constructor(public error: unknown, public retryCount: unknown) {}
}
