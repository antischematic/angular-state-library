import {Observable} from "rxjs";
import {ChangeDetectorRef, EnvironmentInjector, inject} from "@angular/core";

export function loadEffect<TArgs extends unknown[], TReturn extends Observable<unknown>>(load: () => Promise<{ default: (...args: TArgs) => TReturn }>): (...args: TArgs) => Promise<TReturn> {
   return async function (...args: any[]) {
      const injector = inject(EnvironmentInjector)
      const changeDetector = inject(ChangeDetectorRef)
      const mod = await load()
      changeDetector.markForCheck()
      return injector.runInContext(() => {
         return mod.default(...args as TArgs)
      })
   }
}
