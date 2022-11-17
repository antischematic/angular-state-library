import {
   ChangeDetectorRef, ErrorHandler,
   inject,
   Injectable,
   KeyValueDiffers,
   ProviderToken,
   Type,
} from "@angular/core";
import {
   BehaviorSubject,
   defer,
   distinctUntilChanged,
   EMPTY,
   filter,
   isObservable,
   map,
   Observable,
   Observer,
   shareReplay,
   skip,
   startWith,
   Subject,
   Subscription,
} from "rxjs";
import {Select} from "./decorators";
import {addTeardown} from "./hooks";
import {EventType, StoreEvent} from "./interfaces";
import {getMeta, selector, setMeta} from "./metadata";
import {EVENTS, FLUSHED} from "./providers";
import {track} from "./proxy";
import {getId} from "./utils";

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
   from?: Observable<T>
}

export interface WithState<T> {
   source: Observable<T>
   destination: BehaviorSubject<T>
}

export interface Selector {
   new<T>(name: string, factory: (source: Observable<T>) => WithState<T>): Type<BehaviorSubject<T>>
   new<T>(name: string, factory: (source: Observable<T>) => Observable<T>): Type<Observable<T>>
}

export function withState<T>(initial: T, options: WithStateOptions<T> = {}): WithState<T> {
   const destination = new BehaviorSubject(initial)
   const source = options.from ?? EMPTY

   return {
      destination,
      source,
   }
}

export const Selector: Selector = function Selector(name: string, select: Function) {
   @Injectable()
   class Selector implements OnSelect {
      source: Observable<any>
      destination: BehaviorSubject<any>
      connected = false
      subscription = new Subscription()
      target: Subject<any>

      get value() {
         this.connect()
         return this.destination.value
      }

      connect() {
         if (!this.connected) {
            this.connected = true
            this.subscription.add(this.source.subscribe(this.destination))
         }
      }

      next(value: any) {
         this.target.next(value)
      }

      ngOnSelect(observer: Partial<Observer<any>>) {
         try {
            return this.destination.pipe(skip(1)).subscribe(observer)
         } finally {
            this.connect()
         }
      }

      subscribe(observer: any) {
         try {
            return this.destination.subscribe(observer)
         } finally {
            this.connect()
         }
      }

      ngOnDestroy() {
         this.subscription.unsubscribe()
      }

      constructor() {
         const subject = new Subject()
         const selection = select(subject)
         if (isObservable(selection)) {
            this.source = selection
            this.destination = new BehaviorSubject(undefined)
         } else {
            this.source = selection.source
            this.destination = selection.destination
         }
         this.target = select.length > 0 ? subject : this.destination
      }

      static overriddenName = name
   }
   return Selector
} as any

class SelectObserver {
   next(value: any) {
      this.target[this.key] = track(value)
      this.events.next({
         id: getId(),
         context: this.target,
         name: this.key,
         value: [value],
         type: EventType.Dispatch,
         timestamp: Date.now()
      })
      this.cdr.markForCheck()
   }
   error(error: unknown) {
      this.errorHandler.handleError(error)
   }
   complete() {}
   constructor(private target: any, private key: any, private events: Subject<StoreEvent>, private cdr: ChangeDetectorRef, private errorHandler: ErrorHandler) {}
}

export function subscribe<T extends {}>(token: ProviderToken<T> | undefined, directive: any, key: string): any {
   const instance =  token ? inject(token) : directive[key]
   const observer = new SelectObserver(directive, key, inject(EVENTS), inject(ChangeDetectorRef), inject(ErrorHandler))
   const subscription = instance.ngOnSelect?.(observer) ?? instance.subscribe?.(observer)
   if (!subscription) {
      console.error('Directive:', directive)
      console.error('Key:', key)
      console.error('Object:', instance)
      throw new Error(`Object does not implement OnSelect or Subscribable interfaces`)
   }
   addTeardown(subscription)
}

export interface OnSelect {
   ngOnSelect(observer: Observer<any>): Subscription
}
