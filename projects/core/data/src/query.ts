import {
   BehaviorSubject,
   distinctUntilChanged,
   EMPTY,
   expand,
   filter,
   interval,
   last,
   mergeWith,
   MonoTypeOperatorFunction,
   Observable,
   of,
   pipe,
   ReplaySubject,
   share,
   Subject,
   Subscription,
   switchAll,
   switchScan,
   take,
   tap,
   timer
} from "rxjs";
import {EnvironmentInjector, inject, Injector, INJECTOR} from "@angular/core";
import {FetchParams, Page, QueryEvent, QueryFilter, QueryOptions, QueryState, QueryStore} from "./interfaces";
import {createFetch, createInitialEvent, createResult} from "./utils";
import {QUERY_CONFIG} from "./providers";

function getTimer(timers: Map<number, Observable<number>>, ms: number) {
   if (!ms) return EMPTY
   if (timers.has(ms)) {
      return timers.get(ms)!
   }
   const refresh = interval(ms).pipe(
      share({
         resetOnRefCountZero: () => {
            timers.delete(ms)
            return of(0)
         }
      })
   )
   timers.set(ms, refresh)
   return refresh
}

function getInvalidators(timers: Map<number, Observable<number>>, invalidate: Observable<any>, options: QueryOptions<any, any, any, any>) {
   if (options.refreshInterval) {
      invalidate = invalidate.pipe(
         mergeWith(getTimer(timers, options.refreshInterval))
      )
   }
   return invalidate
}

function upsertPage(state: any, cursor: any, pages: Page<any[], any>[], replace: number) {
   const newPages = pages.slice()
   for (const [index, page] of pages.entries()) {
      if (page.previousPage === cursor) {
         newPages.splice(index - replace, replace, state)
         return newPages
      }
      if (page.nextPage === cursor) {
         newPages.splice(index + 1, replace, state)
         return newPages
      }
   }
   return [state]
}

function createPages(event: QueryEvent) {
   const { options } = event.fetch
   if (!options?.previousPage && !options?.nextPage) {
      return event
   }
   const { type, fetch: { queryParams: [pageIndex, ...params] } } = event
   const previousPage = event.state.pages.find(page => page.currentPage === pageIndex)
   const page = { ...previousPage, currentPage: pageIndex, params } as Page<any[], any>

   if (type === "success") {
      page.data = options.select?.(event.state.data) ?? event.state.data
      page.previousPage = options.previousPage?.(event.state.data)
      page.nextPage = options.nextPage?.(event.state.data)
   }

   return {
      ...event,
      state: {
         ...event.state,
         pages: upsertPage(page, pageIndex, event.state.pages, type === "loading" ? 0 : 1)
      }
   }
}

function refreshInfiniteData(environmentInjector: EnvironmentInjector, options: QueryOptions<any[], any>, pages: Page<any[], any>[] = []) {
   return (source: Observable<FetchParams<any[], any>>) => source.pipe(
      createInfiniteResult(environmentInjector),
      filter(event => event.type === "success"),
      expand((event, index) => {
         const current: Page<any[], any> = event.state.pages[index]
         if (current.nextPage !== void 0) {
            return of({ queryFn: event.fetch.queryFn, queryParams: [current.nextPage, ...current.params], options }).pipe(
               createInfiniteResult(environmentInjector, event),
               filter(event => event.type === "success"),
            )
         }
         return EMPTY
      }),
      take(pages.length),
      last(),
   )
}

function createInfiniteQuery(environmentInjector: EnvironmentInjector, queryKey: string, store: QueryStore, options: QueryOptions<any, any, any, any>) {
   if (store.has(queryKey)) {
      return store.get(queryKey)!
   }

   const fetch = new ReplaySubject<FetchParams<any, any, any, any>>(1)
   const result: Observable<QueryEvent<any, any, any, any>> = fetch.pipe(
      switchScan((event, fetch) => {
         return fetch.refresh
            ? of(fetch).pipe(
               refreshInfiniteData(environmentInjector, options, fetch.pages)
            )
            : of(fetch).pipe(
               createInfiniteResult(environmentInjector, event)
            )
      }, createInitialEvent() as QueryEvent<any, any, any, any>),
      shareCache(store, queryKey, options)
   )

   store.set(queryKey, { fetch, result })

   return { fetch, result }
}

function createInfiniteResult(environmentInjector: EnvironmentInjector, initialEvent: QueryEvent = createInitialEvent()) {
   return pipe(
      createFetch(environmentInjector),
      createResult(initialEvent, createPages),
   )
}

function shareCache<T>(store: QueryStore, queryKey: string, { cacheTime = 300_000 }: QueryOptions<any[], any>): MonoTypeOperatorFunction<T> {
   return share({
      connector: () => new BehaviorSubject<any>(createInitialEvent()),
      resetOnRefCountZero: () => {
         return (cacheTime ? timer(cacheTime): of(0)).pipe(
            tap(() => store.delete(queryKey))
         )
      }
   })
}

function createQuery(environmentInjector: EnvironmentInjector, queryKey: string, store: QueryStore, options: QueryOptions<any, any, any, any>) {
   if (store.has(queryKey)) {
      return store.get(queryKey)!
   }
   const fetch = new ReplaySubject<FetchParams<any, any, any, any>>(1)
   const result = fetch.pipe(
      createFetch(environmentInjector),
      createResult(),
      shareCache(store, queryKey, options)
   )
   store.set(queryKey, { fetch, result })
   return { fetch, result  }
}

// todo: replace with something better
function stableHash(obj: any) {
   let hash = ""
   const keys: any[] = Object.keys(obj).sort()
   for (const key of keys) {
      const value = obj[key]
      if (typeof value === "object" && value !== null) {
         hash += key + ":" + stableHash(value)
      }
      if (typeof value !== "function") {
         hash += key + ":" + value
      }
   }
   return hash
}

export class QueryClient<TParams extends any[], TResult, TData = TResult, TPageParam = unknown> extends Observable<QueryClient<TParams, TResult, TData, TPageParam>> {
   key = ""
   query = new ReplaySubject<Observable<QueryEvent<TParams, TResult, TData, TPageParam>>>(1)
   connections = 0
   failureCount = 0
   emitter = new ReplaySubject<this>(1)
   subscription = Subscription.EMPTY
   event = createInitialEvent() as QueryEvent<TParams, TResult, TData, TPageParam>
   invalidator = new Subject<{ force?: boolean } | void>()
   window = false
   createQuery
   sub = Subscription.EMPTY
   previousState?: QueryState<TParams, TResult, TData, TPageParam>
   injector: Injector
   environmentInjector: EnvironmentInjector
   config

   get data() {
      return this.isPreviousData ? this.previousState!.data : this.value.data
   }

   get isFetching() {
      // todo: implement network mode
      return this.state === "loading"
   }

   get isLoading() {
      return this.state === "loading"
   }

   get isRefetching() {
      return this.isFetching && !this.isInitialLoading
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

   get isInitialLoading() {
      return this.isFetching && this.value.isInitial
   }

   get isSettled() {
      return this.isSuccess || this.hasError || this.isInitial
   }

   get isInitial() {
      return this.state === "initial"
   }

   get isStale() {
      const { staleTime = 0 } = this.options
      return staleTime > 0
         ? (Date.now() - this.value.updatedAt) >= staleTime
         : true
   }

   get value() {
      return this.event.state
   }

   get state() {
      return this.event.type
   }

   get isInfinite() {
      return !!this.options.nextPage || !!this.options.previousPage
   }

   get pages() {
      return this.isPreviousData ? this.previousState!.pages : this.value.pages
   }

   get last() {
      return this.pages[this.value.pages.length - 1]
   }

   get first() {
      return this.pages[0]
   }

   get hasNextPage() {
      return !!this.last?.nextPage
   }

   get hasPreviousPage() {
      return !!this.first?.previousPage
   }

   get isPreviousData() {
      return this.previousState !== void 0
   }

   next(event: QueryEvent<TParams, TResult, TData, TPageParam>) {
      const mutation = event.type === "mutation"
      const params = event.fetch.queryParams
      if (this.window || mutation) {
         if ((event.type === "initial") && !!this.options.keepPreviousData) {
            if (!this.isPreviousData) {
               this.previousState = this.event.state
            }
         } else if (event.type !== "loading") {
            this.previousState = void 0
         }
         if (event.type === "error") {
            this.failureCount++
         }
         if (event.type === "success") {
            this.failureCount = 0
         }
         if (!mutation) {
            this.sub.unsubscribe()
         }
         if (event.type === "success") {
            this.sub.unsubscribe()
            this.sub = getInvalidators(this.config.timers, this.invalidator, this.options).subscribe(({ force = false } = {}) => {
               this.sub.unsubscribe()
               this.fetchInternal(params as any, {refresh: true, force})
            })
         }
         this.window = event.type !== "success" && event.type !== "error" && !mutation
         this.event = event
         this.emitter.next(this)
      }
   }

   connect() {
      if (!this.connections++) {
         this.config.clients.add(this)
         this.subscription = this.query.pipe(
            distinctUntilChanged(),
            switchAll(),
         ).subscribe(this)
      }
   }

   disconnect() {
      if (this.connections && !--this.connections) {
         this.config.clients.delete(this)
         this.sub.unsubscribe()
         this.subscription.unsubscribe()
      }
   }

   fetch(...queryParams: TPageParam extends unknown ? TParams : [TPageParam, ...TParams]) {
      this.fetchInternal(queryParams)
      return this
   }

   fetchInternal(queryParams: TPageParam extends unknown ? TParams : [TPageParam, ...TParams], { refresh = false, force = false } = {}) {
      this.key = this.getQueryKey(queryParams.slice(+this.isInfinite))
      const { fetch, result } = this.createQuery(
         this.environmentInjector,
         this.key,
         this.config.store as any,
         this.options,
      )
      this.window = true
      if (refresh) {
         result.pipe(take(1)).subscribe(this as any).unsubscribe()
      } else {
         this.query.next(result as any)
      }
      if (this.isSettled && this.isStale || force) {
         this.window = true
         fetch.next({ queryFn: this.options.fetch as any, queryParams, refresh, pages: this.pages as any, options: this.options as any })
      }
   }

   fetchNextPage() {
      if (this.hasNextPage) {
         const params = [this.last.nextPage!, ...this.event.fetch.queryParams.slice(1)] as any
         return this.fetch(...params)
      }
      return EMPTY
   }

   fetchPreviousPage() {
      if (this.hasPreviousPage) {
         const params = [this.first.previousPage!, ...this.event.fetch.queryParams.slice(1)] as any
         return this.fetch(...params)
      }
      return EMPTY
   }

   // todo: replace with something better
   getQueryKey(params: any[]) {
      const { key, cacheTime = 300_000 } = this.options
      const [actualKey, ...rest] = typeof key === "string" ? [key, ...params] : key(params as TParams)
      return actualKey + stableHash([...rest, cacheTime])
   }

   refetch(options: { force?: boolean } = {}) {
      this.invalidator.next(options)
      return this
   }

   setValue(value: Partial<QueryState<TParams, TResult, TData, TPageParam>>) {
      const { fetch, state } = this.event
      this.next({
         type: "mutation",
         fetch,
         state: {
            ...state,
            ...value
         }
      })
   }

   invalidateQueries(filter: QueryFilter, options?: { force?: boolean }) {
      const { clients } = this.injector.get(QUERY_CONFIG)
      return invalidateQueries(clients, filter, options)
   }

   constructor(public options: QueryOptions<TParams, TResult, TData, TPageParam>) {
      super((observer) => {
         this.connect()
         observer.add(this.emitter.subscribe(observer))
         observer.add(() => this.disconnect())
         return observer
      })

      this.injector = options.injector ?? inject(INJECTOR)
      this.environmentInjector = this.injector.get(EnvironmentInjector)
      this.config = this.injector.get(QUERY_CONFIG)
      this.createQuery = this.isInfinite ? createInfiniteQuery : createQuery
   }
}

// todo: fix this so it actually works
export function invalidateQueries(queries: Set<QueryClient<any, any, any, any>>, filter: QueryFilter = {params: []}, options: { force?: boolean } = {force: true}) {
   let didInvalidate = false
   if (typeof filter === "function") {
      throw new Error("Not implemented")
   } else {
      const {name = "", params = [], exact} = filter
      for (const query of Array.from(queries)) {
         const keyMatch = exact ? query.key === name : query.key.startsWith(name)
         let invalidate = params.length === 0 && keyMatch
         if (params.length > query.event.fetch.queryParams.length) {
            continue
         }
         for (const [index, param] of query.event.fetch.queryParams.entries()) {
            if (Object.is(params[index], param)) {
               invalidate = true
               if (!exact) {
                  break
               }
            }
         }
         if (invalidate) {
            query.refetch(options)
         }
         didInvalidate ||= invalidate
      }
      return didInvalidate
   }
}
