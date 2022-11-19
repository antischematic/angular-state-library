import {ChangeDetectorRef, ErrorHandler, inject, ViewRef} from "@angular/core";
import {runInContext} from "./core";
import {ActionMetadata, DispatchObserver, EventType, Metadata, ZoneCompatible} from "./interfaces";
import {catchError, EMPTY, Observable, Subject, tap} from "rxjs";
import {getChanges} from "./proxy";
import {isPlainObject, observeInZone, wrap} from "./utils";
import {ACTION, CONTEXT, EffectScheduler, EventScheduler} from "./providers";

const observers = [EventType.Next, EventType.Error, EventType.Complete, "finalize"] as const

export interface DispatchOptions {
   zone?: "noop" | ZoneCompatible
}

function callObserver(fn: Function, applyThis: any, value: any) {
   fn.call(applyThis, value)
}

export function dispatch<TValue>(source: Observable<TValue>, options?: DispatchOptions): Observable<TValue>
export function dispatch<TValue>(source: Observable<TValue>, observer: DispatchObserver<TValue>, options?: DispatchOptions): Observable<TValue>
export function dispatch<TValue>(source: Observable<TValue>, next: (value: TValue) => void, options?: DispatchOptions): Observable<TValue>
export function dispatch(source: Observable<any>, observerOrOptions: any = {}, options: DispatchOptions = observerOrOptions) {
   const action = inject(ACTION) as Metadata<ActionMetadata>
   const context = inject(CONTEXT).instance as any
   const applyThis = observerOrOptions && !isPlainObject(observerOrOptions) ? observerOrOptions : context
   const errorHandler = inject(ErrorHandler)
   const event = inject(EventScheduler)
   const effect = inject(EffectScheduler)
   const changeDetector = inject(ChangeDetectorRef) as ViewRef
   const signal = new Subject<any>()

   const observer = typeof observerOrOptions === "function" ? { next: observerOrOptions } : { ...observerOrOptions }

   for (const key of observers) {
      wrap(observer!, key, function (fn, value) {
         const isAction = key !== "finalize"
         try {
            if (!changeDetector.destroyed) {
               const deps = new Map()
               isAction && event.schedule(key, action.key, value, getChanges(deps))
               changeDetector.markForCheck()
               runInContext(deps, callObserver, context, false, action.key, fn, applyThis, value)
            }
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
