import {ChangeDetectorRef, inject, ProviderToken, ViewRef} from "@angular/core";
import {Subscribable} from "rxjs";
import {track} from "./proxy";

export function attach<T extends {}>(token: Subscribable<T>, directive?: any, key?: string): never
export function attach<T extends {}>(token: ProviderToken<T>, directive: any, key: string): T
export function attach<T extends {}>(token: ProviderToken<T> | Subscribable<T>, directive?: any, key?: string): unknown {
   const subscribable = token as any
   const instance = inject(subscribable)
   const cdr = inject(ChangeDetectorRef) as ViewRef
   const subscription = Object.getPrototypeOf(instance).constructor.subscribe({
      next(value: any) {
         if (cdr.destroyed) subscription.unsubscribe()
         else {
            if (directive && key) {
               directive[key] = track(value)
            }
            cdr.markForCheck()
         }
      }
   })
   return track(instance)
}

