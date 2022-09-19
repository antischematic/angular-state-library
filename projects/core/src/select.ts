import {ChangeDetectorRef, inject, ProviderToken, ViewRef} from "@angular/core";
import {getMeta, meta, setMeta} from "./metadata";
import {track} from "./proxy";
import {DISPATCHER} from "./core";

export function select<T extends {}>(token: ProviderToken<T>): T {
   const instance = inject(token)
   if (meta.has(token) && !getMeta("connect", instance, token as any)) {
      const cdr = inject(ChangeDetectorRef, { optional: true }) as ViewRef
      if (cdr) {
         const subscription = inject(DISPATCHER).subscribe((event) => {
            if (cdr.destroyed) subscription.unsubscribe()
            if (event.context === instance) {
               cdr.markForCheck()
            }
         })
         setMeta("connect", subscription, instance, token as any)
      }
   }
   return track(instance)
}
