import {inject} from "@angular/core";
import {EffectScheduler} from "./core";
import {
   concatAll,
   exhaustAll,
   mergeAll,
   MonoTypeOperatorFunction,
   Observable,
   OperatorFunction,
   pipe,
   switchAll
} from "rxjs";

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
