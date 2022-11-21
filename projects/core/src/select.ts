import {
   ChangeDetectorRef,
   ErrorHandler,
   inject,
   Injectable,
   Injector,
   INJECTOR,
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
   map, observable,
   Observable,
   Observer,
   skip,
   startWith,
   Subject,
   Subscription,
} from "rxjs";
import {addTeardown} from "./hooks";
import {DispatchEvent, EventType, StoreEvent, TypedChanges} from "./interfaces";
import {EVENTS, EventScheduler} from "./providers";
import {track} from "./proxy";
import {events} from "./utils";

function pick<T, U extends (keyof T)[]>(object: T, keys: U): Pick<T, U[number]>
function pick<T, U extends keyof T>(object: T, keys: U): T[U]
function pick(object: any, keys: PropertyKey | PropertyKey[]): unknown {
   if (Array.isArray(keys)) {
      return keys.reduce((acc, key) => {
         acc[key] = object[key]
         return acc
      }, {} as any)
   }
   return object[keys]
}

export function slice<T extends {}, U extends keyof T>(token: ProviderToken<T>, key: U, injector?: Injector): Observable<T[U]>
export function slice<T extends {}, U extends (keyof T)[]>(token: ProviderToken<T>, key: U, injector?: Injector): Observable<Pick<T, U[number]>>
export function slice(token: ProviderToken<any>, keys: any, injector = inject(INJECTOR)): Observable<unknown> {
   return defer(() => {
      const context = injector.get(token)
      return store(token, injector).pipe(
         map((context) => pick(context, keys)),
         startWith(pick(context, keys)),
         distinctUntilChanged((a, b) => !Array.isArray(keys) ? Object.is(a, b) : keys.every(key => Object.is(a[key], b[key])))
      )
   })
}

export function store<T extends {}>(token: ProviderToken<T>, injector = inject(INJECTOR)): Observable<T> {
   return defer(() => {
      const context = injector.get(token)
      return injector.get(EVENTS).pipe(
         filter(event => event.changes.has(context)),
         map(() => context)
     )
   })
}

export function inputs<T>(token: ProviderToken<T>, injector = inject(INJECTOR)): Observable<TypedChanges<T>> {
   return defer(() => {
      return events(token, injector).pipe(
         filter((event: StoreEvent): event is DispatchEvent => event.name === "ngOnChanges"),
         map(event => event.value as TypedChanges<T>)
      )
   })
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

      [observable]() {
         return this
      }

      get value() {
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

      pipe(...operators: any[]) {
         return this.destination.pipe(...operators as [])
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
      const previous = this.target[this.key]
      this.target[this.key] = track(value)
      const changes = new Map([[this.target, new Map([[this.key, previous]])]])
      this.event.schedule(EventType.Dispatch, this.key, value, changes)
      this.cdr.markForCheck()
   }
   error(error: unknown) {
      console.error("Error thrown in Select")
      console.error("Directive:", this.target)
      console.error("Key:", this.key)
      this.errorHandler.handleError(error)
   }
   complete() {}
   constructor(private target: any, private key: any, private event: EventScheduler, private cdr: ChangeDetectorRef, private errorHandler: ErrorHandler) {}
}

export function subscribe<T extends {}>(token: ProviderToken<T> | undefined, directive: any, key: string): any {
   const instance =  token ? inject(token) : directive[key]
   const observer = new SelectObserver(directive, key, inject(EventScheduler), inject(ChangeDetectorRef), inject(ErrorHandler))
   const subscription = instance.ngOnSelect?.(observer) ?? instance.subscribe?.(observer)
   if (!subscription) {
      console.error('Directive:', directive)
      console.error('Key:', key)
      console.error('Object:', instance)
      throw new Error(`Object does not implement OnSelect or Subscribable interfaces`)
   }
   directive[key] = track(directive[key])
   addTeardown(subscription)
}

export interface OnSelect {
   ngOnSelect(observer: Observer<any>): Subscription
}
