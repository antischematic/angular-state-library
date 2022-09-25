import {inject} from "@angular/core";
import {EffectScheduler} from "./core";
import {concatAll, exhaustAll, mergeAll, ObservableInput, OperatorFunction, switchAll} from "rxjs";

export function useOperator<T extends OperatorFunction<ObservableInput<unknown>, unknown>>(operator: T) {
   inject(EffectScheduler).operator = operator
}

export function useSwitch() {
   useOperator(switchAll())
}

export function useMerge(concurrent?: number) {
   useOperator(mergeAll(concurrent))
}

export function useConcat() {
   useOperator(concatAll())
}

export function useExhaust() {
   useOperator(exhaustAll())
}
