import {ChangeDetectorRef, ErrorHandler, inject} from "@angular/core";
import {ActionMetadata, DispatchObserver, EventType, Metadata} from "./interfaces";
import {catchError, EMPTY, Observable, Subject, tap} from "rxjs";
import {isPlainObject, noop, observeInZone, wrap} from "./utils";
import {ACTION, CONTEXT, EffectScheduler, EventScheduler} from "./providers";

const observers = [EventType.Next, EventType.Error, EventType.Complete, "finalize"] as const

export function dispatch<TValue>(source: Observable<TValue>): Observable<TValue>
export function dispatch<TValue>(source: Observable<TValue>, observer: DispatchObserver<TValue>): Observable<TValue>
export function dispatch<TValue>(source: Observable<TValue>, next: (value: TValue) => void): Observable<TValue>
export function dispatch(source: Observable<any>, observer?: any) {
   const action = inject(ACTION) as Metadata<ActionMetadata>
   const context = observer && !isPlainObject(observer) ? observer : inject(CONTEXT).instance
   const event = inject(EventScheduler)
   const effect = inject(EffectScheduler)
   const errorHandler = inject(ErrorHandler)
   const changeDetector = inject(ChangeDetectorRef)
   const signal = new Subject<any>()

   observer = typeof observer === "function" ? { next: observer } : { ...observer }

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
   ), Zone.current))

   return signal as any
}
