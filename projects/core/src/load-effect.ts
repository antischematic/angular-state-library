import {Observable} from "rxjs";
import {EnvironmentInjector, inject} from "@angular/core";
import {EffectScheduler} from "./core";

export function loadEffect<TArgs extends unknown[], TReturn extends Observable<unknown>>(load: () => Promise<{ default: (...args: TArgs) => TReturn }>): (...args: TArgs) => TReturn {
   return function (...args: any[]) {
      const injector = inject(EnvironmentInjector)
      const effect = inject(EffectScheduler)
      const promise = load().then((mod) => {
         return injector.runInContext(() => {
            return mod.default(...args as TArgs)
         })
      })

      effect.addPending(promise)

      return new Observable(subscriber => {
         promise
            .then(source => {
               source.subscribe(subscriber)
            })
            .catch(e => {
               subscriber.error(e)
            })
      }) as TReturn
   }
}
