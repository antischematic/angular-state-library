import {ChangeDetectorRef, ErrorHandler, inject} from "@angular/core";
import {ActionMetadata, DispatchObserver, EventType, Metadata, ZoneCompatible} from "./interfaces";
import {catchError, EMPTY, Observable, Subject, tap} from "rxjs";
import {isPlainObject, observeInZone, wrap} from "./utils";
import {ACTION, CONTEXT, EffectScheduler, EventScheduler} from "./providers";

const observers = [EventType.Next, EventType.Error, EventType.Complete, "finalize"] as const

export interface DispatchOptions {
   zone?: "noop" | ZoneCompatible
}

export function dispatch<TValue>(source: Observable<TValue>, options?: DispatchOptions): Observable<TValue>
export function dispatch<TValue>(source: Observable<TValue>, observer: DispatchObserver<TValue>, options?: DispatchOptions): Observable<TValue>
export function dispatch<TValue>(source: Observable<TValue>, next: (value: TValue) => void, options?: DispatchOptions): Observable<TValue>
export function dispatch(source: Observable<any>, observerOrOptions: any = {}, options: DispatchOptions = observerOrOptions) {
   const action = inject(ACTION) as Metadata<ActionMetadata>
   const context = observerOrOptions && !isPlainObject(observerOrOptions) ? observerOrOptions : inject(CONTEXT).instance
   const event = inject(EventScheduler)
   const effect = inject(EffectScheduler)
   const errorHandler = inject(ErrorHandler)
   const changeDetector = inject(ChangeDetectorRef)
   const signal = new Subject<any>()

   const observer = typeof observerOrOptions === "function" ? { next: observerOrOptions } : { ...observerOrOptions }

   for (const key of observers) {
      wrap(observer!, key, function (fn, value) {
         const isAction = key !== "finalize"
         try {
            isAction && event.schedule(key, action.key, value)
            changeDetector.markForCheck()
            fn.call(context, value)
         } finally {
            if (isAction) {
               signal[key](value)
            } else {
               signal.complete()
            }
         }
      })
   }

   effect.enqueue(observeInZone(source.pipe(
      tap(observer),
      catchError(e => {
         errorHandler.handleError(e)
         return EMPTY
      })
   ), options.zone === "noop" ? Zone.root : options.zone ?? Zone.current))

   return signal as any
}
