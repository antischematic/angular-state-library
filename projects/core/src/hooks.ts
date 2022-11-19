import {inject} from "@angular/core";
import {
   concatAll,
   exhaustAll,
   mergeAll,
   MonoTypeOperatorFunction,
   Observable,
   OperatorFunction,
   pipe,
   Subscription,
   switchAll,
   TeardownLogic
} from "rxjs";
import {TypedChanges} from "./interfaces";
import {Changes, EffectScheduler, Teardown} from "./providers";

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

export function useInputs<T>(): TypedChanges<T> {
   return inject(Changes).value
}
