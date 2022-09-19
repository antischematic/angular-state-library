import {ErrorHandler, inject, ProviderToken} from "@angular/core";
import {ActionType, Dispatch} from "./interfaces";
import {Subject, switchAll, tap} from "rxjs";
import {ACTION, EffectScheduler} from "./core";
import {dispatch, isPlainObject, wrap} from "./utils";
import {markDirty} from "./metadata";
import {operators} from "./create-effect";

const observers = [ActionType.Next, ActionType.Error, ActionType.Complete, "finalize"] as const

function hasErrorHandler(observer: any) {
   return ActionType.Error in observer
}

export function createDispatch<T>(token: ProviderToken<T>): Dispatch<T> {
   return function (source, observer = {}) {
      const action = inject(ACTION)
      const context = observer && !isPlainObject(observer) ? observer : inject(token)
      const effect = inject(EffectScheduler)
      const errorHandler = inject(ErrorHandler)
      for (const key of observers) {
         if (key in observer) {
            wrap(observer, key, function (fn, value) {
               if (key !== "finalize") {
                  dispatch(key, context, action.key, value)
               }
               markDirty(context)
               try {
                  fn.call(context, value)
               } catch (e) {
                  errorHandler.handleError(e)
               }
            })
         }
      }
      const signal = new Subject<any>()
      const operator = operators.get(source) ?? switchAll()

      source = source.pipe(tap(observer), tap({
         next(v) {
            signal.next(v)
         },
         error(e) {
            if (!hasErrorHandler(observer)) {
               errorHandler.handleError(e)
            }
            signal.error(e)
         },
         complete() {
            signal.complete()
         }
      }))

      effect.enqueue(source, operator)

      return signal as any
   }
}
