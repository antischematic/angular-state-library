import {ChangeDetectorRef, ErrorHandler, inject} from "@angular/core";
import {EventType, DispatchObserver} from "./interfaces";
import {Observable, Subject, tap} from "rxjs";
import {ACTION, CONTEXT, EffectScheduler, EventScheduler} from "./core";
import {isPlainObject, wrap} from "./utils";

const observers = [EventType.Next, EventType.Error, EventType.Complete, "finalize"] as const

export function dispatch<TValue>(source: Promise<Observable<TValue>>): Observable<TValue>
export function dispatch<TValue>(source: Promise<Observable<TValue>>, observer: DispatchObserver<TValue>): Observable<TValue>
export function dispatch<TValue>(source: Promise<Observable<TValue>>, next: (value: TValue) => void): Observable<TValue>
export function dispatch<TValue>(source: Observable<TValue>): Observable<TValue>
export function dispatch<TValue>(source: Observable<TValue>, observer: DispatchObserver<TValue>): Observable<TValue>
export function dispatch<TValue>(source: Observable<TValue>, next: (value: TValue) => void): Observable<TValue>
export function dispatch(source: Observable<any> | Promise<Observable<any>>, observer?: any) {
   const action = inject(ACTION)
   const context = observer && !isPlainObject(observer) ? observer : inject(CONTEXT)
   const event = inject(EventScheduler)
   const effect = inject(EffectScheduler)
   const errorHandler = inject(ErrorHandler)
   const changeDetector = inject(ChangeDetectorRef)
   const signal = new Subject<any>()
   const enqueue = (source: Observable<any>) => effect.enqueue(source.pipe(tap(observer as {})))

   observer = typeof observer === "function" ? { next: observer } : Object.create(observer ?? null)

   for (const key of observers) {
      wrap(observer!, key, function (fn, value) {
         const isAction = key !== "finalize"
         try {
            isAction && event.schedule(key, context, action.key, value)
            changeDetector.markForCheck()
            fn.call(context, value)
         } catch (e) {
            errorHandler.handleError(e)
         } finally {
            isAction && signal[key](value)
         }
      })
   }

   if ("then" in source) {
      source.then(enqueue).catch(e => errorHandler.handleError(e))
   } else {
      enqueue(source)
   }

   return signal as any
}
