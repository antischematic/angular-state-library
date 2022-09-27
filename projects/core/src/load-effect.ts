import {Observable, tap} from "rxjs";
import {ChangeDetectorRef, EnvironmentInjector, inject} from "@angular/core";
import {EffectScheduler} from "./core";

export function loadEffect<TArgs extends unknown[], TReturn extends Observable<unknown>>(load: () => Promise<{ default: (...args: TArgs) => TReturn }>): (...args: TArgs) => TReturn {
   return function (...args: any[]) {
      const injector = inject(EnvironmentInjector)
      const changeDetector = inject(ChangeDetectorRef)
      const effect = inject(EffectScheduler)
      return new Observable(subscriber => {
         const promise = load()
            .then(mod => {
               changeDetector.markForCheck()
               injector.runInContext(() => {
                  mod.default(...args as TArgs).subscribe(subscriber)
               })
            })
            .catch(e => {
               subscriber.error(e)
            })
         effect.addPending(promise)
      }) as TReturn
   }
}
