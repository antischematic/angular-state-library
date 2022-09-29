import {ChangeDetectorRef, ErrorHandler, inject} from "@angular/core";
import {EventType, DispatchObserver} from "./interfaces";
import {Observable, Subject, tap} from "rxjs";
import {ACTION, CONTEXT, EffectError, EffectScheduler, EventScheduler} from "./core";
import {isPlainObject, noop, wrap} from "./utils";

const observers = [EventType.Next, EventType.Error, EventType.Complete, "finalize"] as const

export function dispatch<TValue>(source: Observable<TValue>): Observable<TValue>
export function dispatch<TValue>(source: Observable<TValue>, observer: DispatchObserver<TValue>): Observable<TValue>
export function dispatch<TValue>(source: Observable<TValue>, next: (value: TValue) => void): Observable<TValue>
export function dispatch(source: Observable<any>, observer?: any) {
   const action = inject(ACTION)
   const context = observer && !isPlainObject(observer) ? observer : inject(CONTEXT).instance
   const event = inject(EventScheduler)
   const effect = inject(EffectScheduler)
   const errorHandler = inject(ErrorHandler)
   const changeDetector = inject(ChangeDetectorRef)
   const signal = new Subject<any>()

   observer = typeof observer === "function" ? { next: observer } : Object.create(observer ?? null)

   for (const key of observers) {
      wrap(observer!, key, function (fn, value) {
         const isAction = key !== "finalize"
         try {
            isAction && event.schedule(key, context, action.key, value)
            changeDetector.markForCheck()
            if (key === "error" && fn === noop) {
               errorHandler.handleError(value)
            } else {
               fn.call(context, value)
            }
         } catch (e) {
            errorHandler.handleError(new EffectError(e))
         } finally {
            if (isAction) {
               signal[key](value)
            } else {
               signal.complete()
            }
         }
      })
   }

   effect.enqueue(source.pipe(tap(observer as {})))

   return signal as any
}
