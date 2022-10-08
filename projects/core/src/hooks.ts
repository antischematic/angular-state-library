import {inject} from "@angular/core";
import {
   concatAll,
   exhaustAll, filter, map,
   mergeAll,
   MonoTypeOperatorFunction,
   Observable,
   OperatorFunction,
   pipe,
   Subscription,
   switchAll,
   TeardownLogic
} from "rxjs";
import {
   EventType,
   Metadata,
   NextEvent,
   SelectMetadata,
   StoreEvent,
   TypedChanges
} from "./interfaces";
import {ACTION, Changes, CONTEXT, EffectScheduler, Teardown} from "./providers";
import {events} from "./utils";
import {getMeta, selector, setMeta} from "./metadata";
import {dispatch} from "./dispatch";

export function useOperator<T extends OperatorFunction<Observable<unknown>, unknown>>(operator: T) {
   const effect = inject(EffectScheduler)
   if (!effect.operator) {
      effect.operator = operator
   }
}

export function useSwitch(operator?: MonoTypeOperatorFunction<Observable<unknown>>) {
   useOperator(operator ? pipe(operator, switchAll()) : switchAll())
}

export function useMerge(): void
export function useMerge(concurrent: number): void
export function useMerge(operator?: MonoTypeOperatorFunction<Observable<unknown>>, concurrent?: number): void
export function useMerge(operator?: MonoTypeOperatorFunction<Observable<unknown>> | number, concurrent: number = operator as number) {
   useOperator(typeof operator === "function" ? pipe(operator, mergeAll(concurrent)) : mergeAll(concurrent))
}

export function useConcat(operator?: MonoTypeOperatorFunction<Observable<unknown>>) {
   useOperator(operator ? pipe(operator, concatAll()) : concatAll())
}

export function useExhaust(operator?: MonoTypeOperatorFunction<Observable<unknown>>) {
   useOperator(operator ? pipe(operator, exhaustAll()) : exhaustAll())
}

export function addTeardown(teardown: TeardownLogic) {
   const subscription = new Subscription()
   subscription.add(teardown)
   inject(Teardown).subscriptions.push(subscription)
}

export function useChanges<T>(): TypedChanges<T> {
   return inject(Changes).value
}

export function action<T>(action: (...args: any) => Observable<T>, instance: unknown = inject(CONTEXT).instance): Observable<T> {
   return events(instance).pipe(
      filter((event: StoreEvent): event is NextEvent => event.name === action.name && event.type === EventType.Next),
      map((event) => event.value)
   )
}

export function snapshot<T>(source: (...args: any[]) => Observable<T>): T | undefined
export function snapshot<T>(source: Observable<T>): T | undefined
export function snapshot<T>(source: Observable<T> | ((...args: any[]) => Observable<T>)): T | undefined {
   const select = inject(ACTION) as Metadata<SelectMetadata>
   const { instance } = inject(CONTEXT) as any
   const scheduler = inject(EffectScheduler)
   const cacheKey = getMeta(selector, instance) as SelectMetadata
   let current = getMeta(cacheKey, instance, select.key) as T

   source = typeof source !== "function"
      ? source
      : action(source)

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
