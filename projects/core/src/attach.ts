import {ChangeDetectorRef, inject, ProviderToken, ViewRef} from "@angular/core";
import {Observer, Subscribable, Subscription} from "rxjs";
import {addTeardown} from "./hooks";
import {track} from "./proxy";

export function attach<T extends {}>(token: ProviderToken<T> | undefined, directive: any, key: string): any {
   const subscribable = token as any
   const cdr = inject(ChangeDetectorRef) as ViewRef
   if (subscribable) {
      const instance = inject(subscribable) as any
      const subscription = instance.ngOnAttach(instance, {
         next(value: any) {
            directive[key] = track(value)
            cdr.markForCheck()
         }
      })
      addTeardown(subscription)
   } else {
      const instance = directive[key]
      const subscription = instance.ngOnAttach(instance, {
         next() {
            cdr.markForCheck()
         }
      })
      addTeardown(subscription)
      directive[key] = track(instance)
   }
}

export interface OnAttach {
   ngOnAttach(instance: unknown, observer: Observer<any>): Subscription
}
