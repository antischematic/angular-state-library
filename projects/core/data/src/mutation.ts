import {
   BehaviorSubject, dematerialize,
   filter,
   mergeAll,
   Observable,
   of,
   ReplaySubject,
   share,
   Subject,
   Subscription,
   tap
} from "rxjs";
import {QUERY_CONFIG} from "./providers";
import {invalidateQueries} from "./query";
import {createFetch, createResult, createInitialEvent} from "./utils";
import {MutationContext, MutationOptions, QueryEvent, QueryFilter} from "./interfaces";
import {EnvironmentInjector, inject, INJECTOR, Injector} from "@angular/core";

class MutationObserver<TParams extends any[], TResult> {
   context: MutationContext<TParams, TResult>

   subscribe() {
      this.context = this.options.onMutate?.(this.context) ?? this.context
   }

   next(value: any) {
      this.context.value = value
      this.context.values = [...this.context.values, value]
      this.context = this.options.onProgress?.(this.context) ?? this.context
   }

   error(error: unknown) {
      this.context.error = error
      this.context = this.options.onError?.(this.context) ?? this.context
   }

   complete() {
      this.context = this.options.onSuccess?.(this.context) ?? this.context
   }

   finalize() {
      this.options.onSettled?.(this.context)
   }

   constructor(client: MutationClient<any, any>, params: TParams, private options: MutationOptions<TParams, TResult>) {
      this.context = {
         error: null,
         value: undefined,
         values: [],
         params,
         invalidateQueries: (...params) => client.invalidateQueries(...params)
      }
   }
}

export class MutationClient<TParams extends any[], TResult> extends Observable<MutationClient<TParams, TResult>> {
   connections = 0
   mutation = new Subject<Observable<QueryEvent<TParams, TResult>>>()
   emitter = new BehaviorSubject<MutationClient<TParams, TResult>>(this)
   event: QueryEvent<TParams, TResult> = createInitialEvent()
   subscription = Subscription.EMPTY
   failureCount = 0
   injector: Injector
   environmentalInjector: EnvironmentInjector

   get data() {
      return this.value.data ?? null
   }

   get isFetching() {
      // todo: implement network mode
      return this.state === "loading"
   }

   get isLoading() {
      return this.state === "loading"
   }

   get isProgress() {
      return this.state === "progress"
   }

   get isSuccess() {
      return this.state === "success"
   }

   get hasError() {
      return this.state === "error"
   }

   get thrownError() {
      return this.value.error
   }

   get isSettled() {
      return !this.isFetching && !this.isProgress
   }

   get value() {
      return this.event.state
   }

   get state() {
      return this.event.type
   }

   next(event: QueryEvent<TParams, TResult>) {
      if (event.type === "error") {
         this.failureCount++
      }
      if (event.type === "success") {
         this.failureCount = 0
      }
      this.event = event
      this.emitter.next(this)
   }

   connect() {
      if (!this.connections++) {
         this.subscription = this.mutation.pipe(
            mergeAll()
         ).subscribe(this)
      }
   }

   disconnect() {
      if (this.connections && !--this.connections) {
         this.subscription.unsubscribe()
      }
   }

   mutate(...params: TParams): Observable<TResult> {
      const fetch = of({ queryFn: this.options.mutate, queryParams: params }).pipe(
         createFetch(this.environmentalInjector, tap(new MutationObserver<TParams, TResult>(this, params, this.options))),
         share({
            connector: () => new ReplaySubject(),
            resetOnComplete: false,
            resetOnRefCountZero: true
         })
      )
      const result = fetch.pipe(createResult())
      this.mutation.next(result)
      return fetch.pipe(
         filter((event): event is any => event.kind !== "F"),
         dematerialize()
      ) as Observable<TResult>
   }

   reset() {
      this.failureCount = 0
      this.event = createInitialEvent()
   }

   invalidateQueries(filter: QueryFilter, options?: { force?: boolean }) {
      const { clients } = this.injector.get(QUERY_CONFIG)
      return invalidateQueries(clients, filter, options)
   }

   constructor(public options: MutationOptions<TParams, TResult>) {
      super((subscriber => {
         this.connect()
         subscriber.add(this.emitter.subscribe(subscriber))
         subscriber.add(() => this.disconnect())
      }));
      this.injector = options.injector ?? inject(INJECTOR)
      this.environmentalInjector = this.injector.get(EnvironmentInjector)
   }
}
