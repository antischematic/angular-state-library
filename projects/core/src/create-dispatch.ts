import {ChangeDetectorRef, ErrorHandler, inject, ProviderToken} from "@angular/core";
import {ActionType, Dispatch} from "./interfaces";
import {Observable, Subject, tap} from "rxjs";
import {ACTION, EffectScheduler, EventScheduler} from "./core";
import {isPlainObject, wrap} from "./utils";

const observers = [ActionType.Next, ActionType.Error, ActionType.Complete, "finalize"] as const

export function createDispatch<T>(token: ProviderToken<T>): Dispatch<T> {
   return function dispatcher(source, observer) {
      const action = inject(ACTION)
      const context = observer && !isPlainObject(observer) ? observer : inject(token)
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
   } as Dispatch<T>
}
