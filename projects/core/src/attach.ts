import {ChangeDetectorRef, inject, ProviderToken, ViewRef} from "@angular/core";
import {Subscribable} from "rxjs";
import {addTeardown} from "./hooks";
import {track} from "./proxy";

export function attach<T extends {}>(token: Subscribable<T>, directive: any, key: string): never
export function attach<T extends {}>(token: ProviderToken<T>, directive: any, key: string): T
export function attach<T extends {}>(token: ProviderToken<T> | Subscribable<T> | undefined, directive: any, key: string): any {
   const subscribable = token as any
   const cdr = inject(ChangeDetectorRef) as ViewRef
   if (subscribable) {
      const instance = inject(subscribable)
      const subscription = Object.getPrototypeOf(instance).constructor.ngOnAttach(instance, {
         next(value: any) {
            directive[key] = track(value)
            cdr.markForCheck()
         }
      })
      addTeardown(subscription)
   } else {
      const instance = directive[key]
      const subscription = Object.getPrototypeOf(instance).constructor.ngOnAttach(instance, {
         next() {
            cdr.markForCheck()
         }
      })
      addTeardown(subscription)
      directive[key] = track(instance)
   }
}
